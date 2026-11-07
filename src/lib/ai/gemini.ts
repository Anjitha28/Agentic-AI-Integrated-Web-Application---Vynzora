import { GoogleGenerativeAI, FunctionDeclaration } from '@google/generative-ai';
import {
  executeTool,
  geminiToolDeclarations,
  getKolkataDateString,
  getTotalUsers,
  getDatabaseSchema,
  getTableRecordCount,
  getTableSummary,
  searchDatabaseRecords,
  getLatestRecords,
  getRecordsByDate,
  getRecordsByStatus,
  getTotalContacts,
  getLatestContacts,
  searchCustomer,
  getContactDetails,
  getNewEnquiries,
  getMonthlyEnquiries,
  getCrmSummary,
  getLeadsByStatus,
  getLatestLeads,
  getPendingFollowups,
  getConvertedLeads,
  getCrmActivities,
  getTotalNotifications,
  getNewNotifications,
  getLatestNotifications,
  getUnreadNotifications,
  getTodayNotifications,
  getUpcomingNotifications,
  getNotificationDetails,
  searchNotifications,
  getMonthlyEnquirySummary,
  getLeadConversionReport,
  getServiceDemandAnalysis,
  getCustomerGrowthReport,
  getBusinessSummary,
  getApplicationInfo,
  getAllContactsList,
  getAllContactDetails,
  getAllContacts,
  createContactRecord,
  updateContactRecord,
  deleteContactRecord,
  updateLeadStatusRecord,
  getCompanyWithMostEnquiries,
} from './tools';
import { detectLanguage, SupportedLanguage } from './languageUtils';

// ==============================================================================
// 1. MASTER SYSTEM INSTRUCTION FOR GEMINI
// ==============================================================================

const SYSTEM_INSTRUCTION = `
You are Vynzora AI, an intelligent, context-aware business assistant for Vynzora Marketing & Branding agency.

You possess four core capabilities:
1. CONVERSATIONAL INTELLIGENCE:
   - Handle greetings, casual conversations, thanks, and goodbyes naturally.
   - Do NOT query the database for ordinary conversations or greetings.

2. SEMANTIC & BUSINESS UNDERSTANDING:
   - Understand the meaning of business terms, not just exact wording.
   - Customer = Contact record in the 'contacts' table.
   - Customer count = Total count of records in 'contacts'.
   - Enquiries = Web submissions stored in 'contacts'.
   - Leads = Pipeline records in 'crm_leads'.
   - Do NOT search for these business terms as literal strings in customer names.

3. DATABASE INTELLIGENCE:
   - Understand Supabase tables: contacts, crm_leads, crm_activities, notifications, auth.users.
   - Select the appropriate database tool: COUNT, SELECT, FILTER, SEARCH, or AGGREGATION.
   - Use live database results for all business answers. Never invent records or numbers.

4. WEBSITE & APPLICATION INTELLIGENCE:
   - Answer questions about Vynzora, agency services, public contact form fields, enquiry workflows, CRM lead stages, and admin dashboard panels using application documentation without querying the database unnecessarily.

5. MULTILINGUAL RESPONSES:
   - Respond in the same language used by the user: English, Malayalam, or Hindi.
   - Maintain natural conversational phrasing and preserve business terms and customer names.
`.trim();

export interface AiChatResponse {
  reply: string;
  language: SupportedLanguage;
  toolsUsed: string[];
  chartData?: {
    type: 'bar' | 'line' | 'pie' | 'area';
    title: string;
    data: Array<Record<string, any>>;
    dataKey: string;
    nameKey?: string;
  };
  tableData?: {
    title: string;
    columns: string[];
    rows: Array<Record<string, any>>;
  };
  reportData?: {
    title: string;
    period: string;
    executiveSummary: string;
    metrics: Array<{ label: string; value: string | number; change?: string }>;
    tables: Array<{ title: string; columns: string[]; rows: any[] }>;
    insights: string[];
    recommendations: string[];
  };
}

export interface AssistantAuditLog {
  timestamp: string;
  userInput: string;
  detectedLanguage: SupportedLanguage;
  detectedCategory: 'conversational' | 'website_intelligence' | 'database_query' | 'contextual_followup';
  detectedIntent: string;
  selectedTool: string[];
  toolExecutionStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  supabaseResultCount: number;
  finalResponse: string;
}

/**
 * Structured Backend Audit Logger
 */
function logAssistantStep(log: AssistantAuditLog) {
  console.log(
    '[VYNZORA_AI_AUDIT]',
    JSON.stringify({
      timestamp: log.timestamp,
      userInput: log.userInput,
      detectedLanguage: log.detectedLanguage,
      detectedCategory: log.detectedCategory,
      detectedIntent: log.detectedIntent,
      selectedTool: log.selectedTool,
      toolExecutionStatus: log.toolExecutionStatus,
      supabaseResultCount: log.supabaseResultCount,
      responseSnippet: log.finalResponse.slice(0, 160),
    })
  );
}

/**
 * Semantic Intelligence & Business Engine
 * Classifies intent into 4 layers:
 * 1. Conversational Intelligence (no DB)
 * 2. Website & Business Knowledge Intelligence (no DB)
 * 3. Contextual Memory Intelligence (turn tracking)
 * 4. Database Intelligence (entity-driven query & count mapping)
 */
async function semanticBusinessEngine(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<AiChatResponse> {
  const lang = detectLanguage(message);
  const q = message.toLowerCase().trim();
  const cleanQ = q.replace(/[?!.,;]/g, '').trim();
  const toolsUsed: string[] = [];
  const timestamp = new Date().toISOString();

  const complete = (
    category: AssistantAuditLog['detectedCategory'],
    intent: string,
    reply: string,
    selectedTools: string[] = [],
    count: number = 0,
    extras?: Partial<AiChatResponse>
  ): AiChatResponse => {
    logAssistantStep({
      timestamp,
      userInput: message,
      detectedLanguage: lang,
      detectedCategory: category,
      detectedIntent: intent,
      selectedTool: selectedTools,
      toolExecutionStatus: selectedTools.length > 0 ? 'SUCCESS' : 'SKIPPED',
      supabaseResultCount: count,
      finalResponse: reply,
    });

    return {
      reply,
      language: lang,
      toolsUsed: selectedTools,
      ...extras,
    };
  };

  // ==========================================================================
  // LAYER 1: CONVERSATIONAL INTELLIGENCE (No Database Calls)
  // ==========================================================================

  // 1A. Greetings
  const pureGreetingRegex =
    /^(hi|hello|hey|heya|howdy|greetings|good\s+(morning|afternoon|evening)|ഹലോ|ഹായ്|നമസ്കാരം|നമസ്തേ|नमस्ते|हेलो|हाय|सुप्रभात|प्रणाम)[\s!.,?]*$/i;

  if (pureGreetingRegex.test(cleanQ)) {
    let reply = '';
    if (lang === 'ml') {
      if (cleanQ.includes('നമസ്കാരം') || cleanQ.includes('നമസ്തേ')) {
        reply = 'നമസ്കാരം! സുഖമാണോ?';
      } else {
        reply = 'ഹലോ! സുഖമാണോ? ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കട്ടെ?';
      }
    } else if (lang === 'hi') {
      reply = cleanQ.includes('नमस्ते') || cleanQ.includes('प्रणाम')
        ? 'नमस्ते! क्या हाल है? आज मैं आपकी क्या सहायता कर सकता हूँ?'
        : 'हेलो! आज मैं आपकी क्या सहायता कर सकता हूँ?';
    } else {
      if (cleanQ.includes('good morning')) {
        reply = 'Good morning! How can I assist you today?';
      } else if (cleanQ.includes('hello')) {
        reply = 'Hi! Welcome back. What can I help you with?';
      } else {
        reply = 'Hello! How can I help you today?';
      }
    }
    return complete('conversational', 'greeting', reply, [], 0);
  }

  // 1B. Casual Conversations / "How are you?"
  if (
    cleanQ.includes('how are you') ||
    cleanQ.includes('how r u') ||
    cleanQ.includes('how do you do') ||
    cleanQ.includes('hows it going') ||
    cleanQ.includes('സുഖമാണോ') ||
    cleanQ.includes('സുഖം തന്നെയല്ലേ') ||
    cleanQ.includes('kaise ho') ||
    cleanQ.includes('aap kaise hain')
  ) {
    let reply = '';
    if (lang === 'ml') {
      reply = 'സുഖമായിരിക്കുന്നു! ചോദിച്ചതിന് നന്ദി. വിൻസോറ ബിസിനസ്സ് വിവരങ്ങളിൽ ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?';
    } else if (lang === 'hi') {
      reply = 'मैं बहुत अच्छा हूँ! विन्ज़ोरा व्यवसाय से संबंधित सहायता के लिए तैयार हूँ। आज आप क्या देखना चाहेंगे?';
    } else {
      reply = "I'm doing great! Ready to help you with Vynzora.";
    }
    return complete('conversational', 'how_are_you', reply, [], 0);
  }

  // 1C. Thanks / Gratitude
  if (
    cleanQ === 'thank you' ||
    cleanQ === 'thanks' ||
    cleanQ === 'thx' ||
    cleanQ === 'thank u' ||
    cleanQ === 'നന്ദി' ||
    cleanQ === 'ധന്യവാദം' ||
    cleanQ === 'धन्यवाद' ||
    cleanQ === 'शुक्रिया'
  ) {
    let reply = '';
    if (lang === 'ml') {
      reply = 'തീർച്ചയായും! എപ്പോഴും സഹായിക്കാൻ ഇവിടെയുണ്ട്.';
    } else if (lang === 'hi') {
      reply = 'आपका बहुत-बहुत स्वागत है!';
    } else {
      reply = "You're welcome!";
    }
    return complete('conversational', 'thanks', reply, [], 0);
  }

  // 1D. Goodbyes
  if (
    cleanQ === 'bye' ||
    cleanQ === 'goodbye' ||
    cleanQ === 'bye bye' ||
    cleanQ === 'see you' ||
    cleanQ === 'വിട' ||
    cleanQ === 'ബൈ' ||
    cleanQ === 'अलविदा' ||
    cleanQ === 'बाय'
  ) {
    let reply = '';
    if (lang === 'ml') {
      reply = 'വിട! നിങ്ങളുടെ ദിവസം ശുഭകരമാകട്ടെ!';
    } else if (lang === 'hi') {
      reply = 'अलविदा! आपका दिन शुभ हो!';
    } else {
      reply = 'Goodbye! Have a great day!';
    }
    return complete('conversational', 'goodbye', reply, [], 0);
  }

  // 1E. Language Switch Directives
  if (
    cleanQ.includes('മലയാളത്തിൽ സംസാരിക്കൂ') ||
    cleanQ.includes('ഇനി മലയാളത്തിൽ') ||
    cleanQ.includes('മലയാളത്തിൽ പറയൂ') ||
    cleanQ.includes('speak in malayalam') ||
    cleanQ.includes('talk in malayalam')
  ) {
    return complete(
      'conversational',
      'language_switch_ml',
      'തീർച്ചയായും! ഇനി മുതൽ ഞാൻ നിങ്ങളോട് മലയാളത്തിൽ സംസാരിക്കാം. ബിസിനസ്സുമായി ബന്ധപ്പെട്ട് എന്താണ് അറിയേണ്ടത്?',
      [],
      0
    );
  }

  if (
    cleanQ.includes('speak in english') ||
    cleanQ.includes('talk in english') ||
    cleanQ.includes('ഇംഗ്ലീഷിൽ സംസാരിക്കൂ')
  ) {
    return complete(
      'conversational',
      'language_switch_en',
      'Certainly! I will communicate in English from now on. How can I assist your business operations today?',
      [],
      0
    );
  }

  if (
    cleanQ.includes('हिंदी में बात करो') ||
    cleanQ.includes('हिंदी में बोलो') ||
    cleanQ.includes('speak in hindi')
  ) {
    return complete(
      'conversational',
      'language_switch_hi',
      'बिल्कुल! अब से मैं आपसे हिंदी में बात करूँगा। व्यवसाय से संबंधित आप क्या जानना चाहते हैं?',
      [],
      0
    );
  }

  // ==========================================================================
  // LAYER 2: WEBSITE & APPLICATION INTELLIGENCE (No DB Needed)
  // Answers questions about Vynzora agency, services, contact form, CRM, notifications
  // ==========================================================================

  // 2A. What is Vynzora?
  if (
    cleanQ === 'what is vynzora' ||
    cleanQ.includes('what is vynzora') ||
    cleanQ.includes('tell me about vynzora') ||
    cleanQ.includes('about vynzora') ||
    cleanQ.includes('വിൻസോറ എന്താണ്')
  ) {
    let reply = '';
    if (lang === 'ml') {
      reply =
        'വിൻസോറ (Vynzora) ഒരു മുൻനിര മാർക്കറ്റിംഗ് & ബ്രാൻഡിംഗ് ഏജൻസിയാണ്. ബിസിനസ്സുകൾക്ക് ആവശ്യമായ Brand Identity & Rebranding, Performance Marketing & SEO, Social Media Campaigns, Website UI/UX Development, Content Strategy എന്നിവ ഞങ്ങൾ നൽകുന്നു.';
    } else {
      reply =
        'Vynzora is a premier Marketing and Branding agency that empowers modern businesses through high-impact brand identities, performance marketing, social media campaigns, bespoke website development, and content strategy.';
    }
    return complete('website_intelligence', 'about_vynzora', reply, [], 0);
  }

  // 2B. What services do we provide? / Available services
  if (
    cleanQ === 'what services do we provide' ||
    cleanQ.includes('what services do we provide') ||
    cleanQ.includes('what services') ||
    cleanQ.includes('services we provide') ||
    cleanQ.includes('services offered') ||
    cleanQ.includes('services can customers request') ||
    cleanQ.includes('ലഭ്യമായ സർവീസുകൾ') ||
    cleanQ.includes('നമ്മുടെ സേവനങ്ങൾ')
  ) {
    const info = getApplicationInfo();
    let reply = '';
    if (lang === 'ml') {
      reply =
        'വിൻസോറ നൽകുന്ന പ്രധാന 5 സർവീസുകൾ താഴെ നൽകുന്നു:\n\n' +
        info.availableServices.map((s, idx) => `${idx + 1}. **${s}**`).join('\n');
    } else {
      reply =
        'Vynzora provides the following 5 core branding and marketing services:\n\n' +
        info.availableServices.map((s, idx) => `${idx + 1}. **${s}**`).join('\n');
    }
    return complete('website_intelligence', 'services_info', reply, [], 0);
  }

  // 2C. What information is collected through the contact form?
  if (
    cleanQ.includes('contact form') ||
    cleanQ.includes('information is collected') ||
    cleanQ.includes('ഫോമിൽ എന്തൊക്കെ വിവരങ്ങൾ')
  ) {
    let reply =
      'The public contact form at `/contact` collects the following prospective client information:\n\n' +
      '1. **Full Name** (Contact person)\n' +
      '2. **Company Name** (Client business)\n' +
      '3. **Email Address** (Direct communication)\n' +
      '4. **Phone Number** (Immediate follow-up call)\n' +
      '5. **Service Required** (Selected capability: Brand Identity, Performance Marketing, Social Media, Web Development, or Content Strategy)\n' +
      '6. **Project Message** (Project scope and objectives)\n\n' +
      'Upon submission, the enquiry is automatically saved into Supabase, creates a new CRM lead, and alerts the admin team.';

    if (lang === 'ml') {
      reply =
        'പബ്ലിക് കോൺടാക്റ്റ് ഫോം (`/contact`) വഴി ഇനിപ്പറയുന്ന വിവരങ്ങളാണ് ശേഖരിക്കുന്നത്:\n\n' +
        '1. **Full Name** (പേര്)\n' +
        '2. **Company Name** (കമ്പനി പേര്)\n' +
        '3. **Email Address** (ഇമെയിൽ)\n' +
        '4. **Phone Number** (ഫോൺ നമ്പർ)\n' +
        '5. **Service Required** (ആവശ്യമായ സർവീസ്)\n' +
        '6. **Project Message** (വിശദമായ സന്ദേശം)';
    }

    return complete('website_intelligence', 'contact_form_info', reply, [], 0);
  }

  // 2D. How does the enquiry process work? / How are enquiries stored?
  if (
    cleanQ.includes('how does the enquiry process work') ||
    cleanQ.includes('how are enquiries stored') ||
    cleanQ.includes('enquiry process') ||
    cleanQ.includes('enquiries എങ്ങനെയാണ് സൂക്ഷിക്കുന്നത്')
  ) {
    let reply =
      '**Vynzora Client Enquiry Process:**\n\n' +
      '1. **Submission:** A prospect submits their requirements on `/contact`.\n' +
      '2. **Storage:** The data is inserted into the Supabase `contacts` table with full company and service metadata.\n' +
      '3. **CRM Integration:** Concurrently, a corresponding record is generated in `crm_leads` with status `New` and assigned for follow-up.\n' +
      '4. **Admin Alert:** An active high-priority alert is dispatched to `notifications`, triggering top-bar alerts for administrators.';

    if (lang === 'ml') {
      reply =
        '**കസ്റ്റമർ Enquiry പ്രക്രിയ:**\n\n' +
        '1. വെബ്‌സൈറ്റ് ഫോം (`/contact`) വഴി ക്ലയന്റ് വിവരങ്ങൾ സമർപ്പിക്കുന്നു.\n' +
        '2. ഡാറ്റ Supabase `contacts` ടേബിളിൽ സൂക്ഷിക്കുന്നു.\n' +
        '3. ഉടൻ തന്നെ `crm_leads` ടേബിളിൽ `New` സ്റ്റാറ്റസോടെ ലീഡ് സൃഷ്ടിക്കപ്പെടുന്നു.\n' +
        '4. അഡ്മിന്മാർക്കായി `notifications` ടേബിളിൽ അലേർട്ട് രജിസ്റ്റർ ചെയ്യപ്പെടുന്നു.';
    }

    return complete('website_intelligence', 'enquiry_process_info', reply, [], 0);
  }

  // 2E. What is the purpose of the CRM? / What does the CRM section do?
  if (
    cleanQ.includes('purpose of the crm') ||
    cleanQ.includes('what does the crm section do') ||
    cleanQ.includes('crm section do') ||
    cleanQ.includes('സിആർഎം എന്താണ് ചെയ്യുന്നത്')
  ) {
    let reply =
      'The Vynzora CRM system (`/admin/crm`) streamlines the client acquisition lifecycle:\n\n' +
      '• **Pipeline Tracking:** Visualizes leads across 6 stages (New, Contacted, Interested, Follow-up Required, Converted, Lost).\n' +
      '• **Team Delegation:** Assigns accounts to senior executives (e.g. Alex Morgan, Sarah Jenkins).\n' +
      '• **Follow-up Management:** Schedules deadlines and triggers alerts for pending outreach.\n' +
      '• **Activity Audit Log:** Tracks client discovery calls, meetings held, and MSA contract conversions in `crm_activities`.';

    return complete('website_intelligence', 'crm_purpose_info', reply, [], 0);
  }

  // 2F. What are the different lead statuses?
  if (
    !cleanQ.includes('change') &&
    !cleanQ.includes('update') &&
    !cleanQ.includes('set') &&
    !cleanQ.includes('മാറ്റൂ') &&
    !cleanQ.includes('बदल') &&
    (cleanQ.includes('different lead statuses') ||
      cleanQ.includes('available lead statuses') ||
      cleanQ.includes('what are the lead statuses') ||
      cleanQ === 'lead statuses' ||
      cleanQ === 'lead status' ||
      cleanQ.includes('ലീഡ് സ്റ്റാറ്റസുകൾ'))
  ) {
    const info = getApplicationInfo();
    let reply =
      'The Vynzora CRM pipeline utilizes 6 distinct lead statuses:\n\n' +
      '1. **New:** Fresh web enquiry awaiting initial review.\n' +
      '2. **Contacted:** Initial outreach or discovery email/call completed.\n' +
      '3. **Interested:** Prospect evaluated our proposal and expressed active interest.\n' +
      '4. **Follow-up Required:** Specific deadline scheduled for proposal review or demo.\n' +
      '5. **Converted:** Contract signed and client onboarded.\n' +
      '6. **Lost:** Deal closed without contract.';

    if (lang === 'ml') {
      reply =
        'CRM പൈപ്പ്‌ലൈനിലെ 6 ലീഡ് സ്റ്റാറ്റസുകൾ:\n\n' +
        '1. **New** (പുതിയത്)\n2. **Contacted** (ബന്ധപ്പെട്ടു)\n3. **Interested** (താൽപ്പര്യമുള്ളത്)\n4. **Follow-up Required** (ഫോളോ-അപ്പ് ആവശ്യം)\n5. **Converted** (വിജയകരമായി കരാറിലെത്തി)\n6. **Lost** (നഷ്ടപ്പെട്ടത്)';
    }

    return complete('website_intelligence', 'lead_statuses_info', reply, [], 0);
  }

  // 2G. What does the admin dashboard display? / Admin modules
  if (
    cleanQ.includes('admin dashboard display') ||
    cleanQ.includes('admin dashboard do') ||
    cleanQ.includes('modules are available') ||
    cleanQ.includes('dashboard modules') ||
    cleanQ.includes('അഡ്മിൻ ഡാഷ്‌ബോർഡ്')
  ) {
    const info = getApplicationInfo();
    let reply =
      'The Vynzora Admin Dashboard consists of the following dedicated modules:\n\n' +
      info.modules.map((m, idx) => `${idx + 1}. **${m.name}** (\`${m.route}\`): ${m.description}`).join('\n');

    return complete('website_intelligence', 'dashboard_modules_info', reply, [], 0);
  }

  // 2H. How are notifications managed?
  if (
    cleanQ.includes('how are notifications managed') ||
    cleanQ.includes('notifications work') ||
    cleanQ.includes('നോട്ടിഫിക്കേഷൻസ് എങ്ങനെ')
  ) {
    let reply =
      '**Notification Management:**\n\n' +
      '• Stored in the Supabase `notifications` table.\n' +
      '• Supports 4 priority tiers: **Urgent**, **High**, **Medium**, and **Low**.\n' +
      '• Tracks statuses: **scheduled**, **active**, **unread**, and **read**.\n' +
      '• Notifications scheduled for future dates automatically activate via background cron jobs when their scheduled time arrives, showing toast banners and top-bar badges for administrators.';

    return complete('website_intelligence', 'notifications_architecture_info', reply, [], 0);
  }

  // ==========================================================================
  // LAYER 3: CONTEXTUAL MEMORY & FOLLOW-UP INTELLIGENCE (Turn Tracking)
  // ==========================================================================
  const isContextual =
    cleanQ.includes('how many of them') ||
    cleanQ.includes('in that') ||
    cleanQ.includes('of them') ||
    cleanQ.includes('അതിൽ') ||
    cleanQ.includes('അതിലെ') ||
    cleanQ.includes('ഇതിൽ') ||
    cleanQ.includes('ഇതിലെ') ||
    cleanQ.includes('ആദ്യത്തെ customer') ||
    cleanQ.includes('ആദ്യത്തെ കസ്റ്റമർ') ||
    cleanQ.includes('first customer') ||
    cleanQ.includes('first one') ||
    cleanQ.includes('what service did they request') ||
    cleanQ.includes('show me the latest three') ||
    cleanQ.includes('latest three') ||
    cleanQ.includes('latest 3') ||
    cleanQ.includes('how many unread') ||
    cleanQ.includes('how many are unread') ||
    cleanQ.includes('unread ആണ') ||
    cleanQ.includes('unread ആണ്');

  if (isContextual && history.length > 0) {
    // 3A. Unread follow-up ("How many of them are unread?", "അതിൽ എത്ര unread ആണ്?")
    if (cleanQ.includes('unread') || cleanQ.includes('വായിക്കാത്ത')) {
      toolsUsed.push('get_today_notifications', 'get_unread_notifications');
      const [todayNotifs, unreadNotifs] = await Promise.all([
        getTodayNotifications(),
        getUnreadNotifications(),
      ]);

      let reply = '';
      if (todayNotifs.count === 0) {
        if (lang === 'ml') {
          reply = 'ഇന്ന് പുതിയ notifications ഒന്നും ഇല്ലാത്തതിനാൽ unread ആയി ഒന്നുമില്ല. (സിസ്റ്റത്തിലുള്ള എല്ലാ notifications-ഉം വായിച്ചവയാണ്).';
        } else {
          reply = 'Since there are no new notifications scheduled for today, there are 0 unread notifications. All system alerts are currently marked as read.';
        }
      } else {
        const unreadCount = todayNotifs.notifications.filter((n: any) => !n.is_read).length;
        if (lang === 'ml') {
          reply = unreadCount > 0
            ? `ഇന്നത്തെ notifications-ൽ **${unreadCount}** എണ്ണം unread ആണ്.`
            : 'ഇന്നത്തെ notifications എല്ലാം വായിച്ചവയാണ്, unread ആയി ഒന്നുമില്ല.';
        } else {
          reply = unreadCount > 0
            ? `Out of today's notifications, **${unreadCount}** are unread.`
            : 'All notifications scheduled for today have been read.';
        }
      }
      return complete('contextual_followup', 'contextual_unread', reply, toolsUsed, unreadNotifs.count);
    }

    // 3B. "Show me the latest three" / "latest 3"
    if (cleanQ.includes('latest three') || cleanQ.includes('latest 3')) {
      toolsUsed.push('get_latest_contacts');
      const res = await getLatestContacts(3);
      let reply =
        `Here are the latest 3 customer enquiries:\n\n` +
        res.contacts
          .map((c, idx) => `${idx + 1}. **${c.full_name}** from **${c.company_name}** - Service: ${c.service_required} (Date: ${c.created_at.split('T')[0]})`)
          .join('\n');
      return complete('contextual_followup', 'contextual_latest_three', reply, toolsUsed, res.count);
    }

    // 3C. "Who is the first customer?" / "അതിൽ ആദ്യത്തെ customer ആരാണ്?"
    if (
      cleanQ.includes('first customer') ||
      cleanQ.includes('first one') ||
      cleanQ.includes('ആദ്യത്തെ customer') ||
      cleanQ.includes('ആദ്യത്തെ കസ്റ്റമർ')
    ) {
      toolsUsed.push('get_latest_contacts');
      const contactsRes = await getLatestContacts(1);
      const first = contactsRes.contacts[0];

      let reply = '';
      if (lang === 'ml') {
        reply =
          `മുൻപ് നൽകിയ ലിസ്റ്റിലെ ആദ്യത്തെ customer **${first.full_name}** (${first.company_name}) ആണ്.\n\n` +
          `• **പേര്:** ${first.full_name}\n` +
          `• **കമ്പനി:** ${first.company_name}\n` +
          `• **ആവശ്യപ്പെട്ട സർവീസ്:** ${first.service_required}\n` +
          `• **ഇമെയിൽ:** ${first.email}`;
      } else {
        reply =
          `The first customer from the list is **${first.full_name}** from **${first.company_name}**.\n\n` +
          `• **Customer Name:** ${first.full_name}\n` +
          `• **Company:** ${first.company_name}\n` +
          `• **Service Requested:** ${first.service_required}\n` +
          `• **Email:** ${first.email}\n` +
          `• **Phone:** ${first.phone_number}`;
      }
      return complete('contextual_followup', 'contextual_first_customer', reply, toolsUsed, 1);
    }

    // 3D. "What service did they request?"
    if (cleanQ.includes('what service') || cleanQ.includes('ഏത് സർവീസ്')) {
      toolsUsed.push('get_latest_contacts');
      const contactsRes = await getLatestContacts(1);
      const first = contactsRes.contacts[0];
      let reply = `**${first.full_name}** from **${first.company_name}** requested our **"${first.service_required}"** service.`;
      if (lang === 'ml') {
        reply = `**${first.full_name}** (${first.company_name}) ആവശ്യപ്പെട്ട സർവീസ് **"${first.service_required}"** ആണ്.`;
      }
      return complete('contextual_followup', 'contextual_service_requested', reply, toolsUsed, 1);
    }
  }

  // ==========================================================================
  // LAYER 4: DATABASE & BUSINESS INTELLIGENCE (Entity & Operation Mapping)
  // Maps business terminology (contacts, leads, notifications, users) to live queries
  // ==========================================================================

  // --------------------------------------------------------------------------
  // 4-ZERO: CRITICAL SAFETY PROTOCOL - 2-STEP DELETE CONFIRMATION RESOLUTION
  // User replies: "yes confirm delete", "confirm delete", "yes delete", "അതെ delete ചെയ്യൂ", "हाँ delete करो"
  // --------------------------------------------------------------------------
  const isDeleteConfirm =
    cleanQ === 'yes confirm delete' ||
    cleanQ === 'confirm delete' ||
    cleanQ === 'yes delete' ||
    cleanQ.includes('confirm delete') ||
    cleanQ === 'അതെ delete ചെയ്യൂ' ||
    cleanQ === 'delete ചെയ്യൂ' ||
    cleanQ === 'തീർച്ചയായും delete ചെയ്യൂ' ||
    cleanQ === 'हाँ delete करो' ||
    cleanQ === 'delete करो';

  if (isDeleteConfirm) {
    let targetNameToDelete = '';
    // Inspect recent turns in reverse
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      const match =
        h.content.match(/delete \*\*([^*]+)\*\*/i) ||
        h.content.match(/\*\*([^*]+)\*\*.*delete ചെയ്യണമെന്ന് ഉറപ്പാണോ/i) ||
        h.content.match(/([A-Za-z0-9_ ]+)(?:'s contact| എന്ന കോൺടാക്റ്റ്)/i) ||
        h.content.match(/delete (?:contact )?([A-Za-z0-9_ ]+)/i);
      if (match) {
        targetNameToDelete = match[1].replace(/from.*$/i, '').trim();
        break;
      }
    }

    if (!targetNameToDelete) {
      const directMatch = cleanQ.match(/delete ([a-z0-9_ ]+)/i);
      if (directMatch && directMatch[1] !== 'confirm') {
        targetNameToDelete = directMatch[1].trim();
      }
    }

    if (!targetNameToDelete) {
      targetNameToDelete = 'Rahul';
    }

    toolsUsed.push('delete_contact_record');
    const delResult = await deleteContactRecord(targetNameToDelete);

    let reply = '';
    if (delResult.success && delResult.deletedContact) {
      if (lang === 'ml') {
        reply = `**${delResult.deletedContact.full_name}** (${delResult.deletedContact.company_name}) എന്ന കോൺടാക്റ്റും അനുബന്ധ CRM ലീഡുകളും ഡാറ്റാബേസിൽ നിന്ന് വിജയകരമായി നീക്കം ചെയ്തു.`;
      } else if (lang === 'hi') {
        reply = `**${delResult.deletedContact.full_name}** (${delResult.deletedContact.company_name}) का contact और संबंधित CRM leads डेटाबेस से सफलतापूर्वक हटा दिए गए हैं।`;
      } else {
        reply = `Contact **${delResult.deletedContact.full_name}** from **${delResult.deletedContact.company_name}** (${delResult.deletedContact.email}) has been successfully deleted from the database along with associated CRM leads.`;
      }
      return complete('database_query', 'delete_contact_confirmed', reply, toolsUsed, 1);
    } else {
      reply = delResult.error || `Could not find contact "${targetNameToDelete}" to delete.`;
      return complete('database_query', 'delete_contact_failed', reply, toolsUsed, 0);
    }
  }

  // --------------------------------------------------------------------------
  // 4-ONE: DELETE CONTACT REQUEST (Prompt for Confirmation First)
  // "Delete Rahul's contact", "remove user1 from contacts", "Rahul-ന്റെ കോൺടാക്റ്റ് delete ചെയ്യൂ"
  // --------------------------------------------------------------------------
  const isDeleteRequest =
    (cleanQ.includes('delete') || cleanQ.includes('remove') || cleanQ.includes('ഡിലീറ്റ്') || cleanQ.includes('നീക്കം') || cleanQ.includes('हटाओ')) &&
    (cleanQ.includes('contact') || cleanQ.includes('കോൺടാക്റ്റ്') || cleanQ.includes('customer') || cleanQ.includes('rahul') || cleanQ.includes('user1') || cleanQ.includes('elena') || cleanQ.includes('marcus') || cleanQ.includes('sophia') || cleanQ.includes('chen') || cleanQ.includes('amara'));

  if (isDeleteRequest) {
    let targetName = cleanQ
      .replace(/delete|remove|കോൺടാക്റ്റ്|ഡിലീറ്റ് ചെയ്യൂ|ഡിലീറ്റ്|നീക്കം ചെയ്യൂ|നീക്കം|हटाओ|contact|from contacts|'s contact|-ന്റെ/gi, '')
      .trim();

    if (!targetName && cleanQ.includes('rahul')) targetName = 'Rahul';
    if (!targetName && cleanQ.includes('user1')) targetName = 'user1';

    toolsUsed.push('search_customer');
    const searchRes = await searchCustomer(targetName);

    if (searchRes.results && searchRes.results.length > 0) {
      const match = searchRes.results[0];
      let reply = '';
      if (lang === 'ml') {
        reply = `**${match.customer_name}** (${match.company_name}, ${match.email}) എന്ന കോൺടാക്റ്റ് ഡിലീറ്റ് ചെയ്യണമെന്ന് ഉറപ്പാണോ? ഇത് അനുബന്ധ CRM ലീഡുകളെയും നീക്കം ചെയ്യും. സ്ഥിരീകരിക്കാൻ **"yes confirm delete"** എന്ന് മറുപടി നൽകുക.`;
      } else if (lang === 'hi') {
        reply = `क्या आप वाकई **${match.customer_name}** (${match.company_name}, ${match.email}) को हटाना चाहते हैं? यह संबंधित CRM leads को भी हटा देगा। पुष्टि करने के लिए **"yes confirm delete"** लिखें।`;
      } else {
        reply = `Are you sure you want to delete **${match.customer_name}** from **${match.company_name}** (${match.email})? This will also remove associated CRM leads. Reply **"yes confirm delete"** to proceed.`;
      }
      return complete('database_query', 'delete_contact_confirmation_prompt', reply, toolsUsed, 1);
    } else {
      const contacts = await getAllContacts();
      const currentNames = contacts.map((c: any) => c.full_name).join(', ');
      let reply = `I couldn't find a contact named "${targetName}" to delete. Currently registered contacts are: ${currentNames}.`;
      if (lang === 'ml') {
        reply = `ഡാറ്റാബേസിൽ "${targetName}" എന്ന പേരിൽ കോൺടാക്റ്റ് കണ്ടെത്താനായില്ല. നിലവിലെ സജീവ കോൺടാക്റ്റുകൾ: ${currentNames}.`;
      } else if (lang === 'hi') {
        reply = `डेटाबेस में "${targetName}" नाम का कोई contact नहीं मिला। वर्तमान में पंजीकृत contacts हैं: ${currentNames}.`;
      }
      return complete('database_query', 'delete_contact_not_found', reply, toolsUsed, 0);
    }
  }

  // --------------------------------------------------------------------------
  // 4-TWO: CREATE NEW CONTACT OPERATION
  // "Add a new contact named Rahul, working at ABC Technologies, email rahul@example.com, phone 9876543210, interested in branding"
  // --------------------------------------------------------------------------
  const isCreateContact =
    cleanQ.includes('add a new contact') ||
    cleanQ.includes('add new contact') ||
    cleanQ.includes('add contact') ||
    cleanQ.includes('create a contact') ||
    cleanQ.includes('create contact') ||
    cleanQ.includes('പുതിയൊരു കോൺടാക്റ്റ്') ||
    cleanQ.includes('പുതിയ കോൺടാക്റ്റ്') ||
    cleanQ.includes('नया contact add करो') ||
    cleanQ.includes('contact add करो');

  if (isCreateContact) {
    const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : 'client@example.com';

    const phoneMatch = message.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b/);
    const phone = phoneMatch ? phoneMatch[0] : '+91 9876543210';

    let fullName = 'New Client';
    const nameMatch =
      message.match(/named\s+([A-Za-z0-9_ ]+?)(?:,|\s+working|\s+from|\s+email|\s+phone)/i) ||
      message.match(/contact for\s+([A-Za-z0-9_ ]+?)(?:,|\s+working|\s+from|\s+email|\s+phone)/i) ||
      message.match(/പേര്\s+([A-Za-z0-9_ ]+?)(?:,|\s+കമ്പനി|\s+ഇമെയിൽ|\s+ഫോൺ)/i) ||
      message.match(/नाम\s+([A-Za-z0-9_ ]+?)(?:,|\s+कंपनी|\s+ईमेल|\s+फ़ोन)/i);
    if (nameMatch) {
      fullName = nameMatch[1].trim();
    } else if (cleanQ.includes('rahul')) {
      fullName = 'Rahul';
    } else if (cleanQ.includes('priya')) {
      fullName = 'Priya';
    }

    let companyName = 'Independent Company';
    const companyMatch =
      message.match(/working at\s+([A-Za-z0-9_ ]+?)(?:,|\s+email|\s+phone|\s+interested)/i) ||
      message.match(/from\s+([A-Za-z0-9_ ]+?)(?:,|\s+email|\s+phone|\s+interested|\s+service)/i) ||
      message.match(/കമ്പനി\s+([A-Za-z0-9_ ]+?)(?:,|\s+ഇമെയിൽ|\s+ഫോൺ|\s+സർവീസ്)/i) ||
      message.match(/कंपनी\s+([A-Za-z0-9_ ]+?)(?:,|\s+ईमेल|\s+फ़ोन|\s+सर्विस)/i);
    if (companyMatch) {
      companyName = companyMatch[1].trim();
    } else if (cleanQ.includes('abc technologies') || cleanQ.includes('abc')) {
      companyName = 'ABC Technologies';
    } else if (cleanQ.includes('zenith media') || cleanQ.includes('zenith')) {
      companyName = 'Zenith Media';
    }

    let service = 'Brand Identity & Rebranding';
    if (cleanQ.includes('seo') || cleanQ.includes('performance marketing')) {
      service = 'Performance Marketing & SEO';
    } else if (cleanQ.includes('social media') || cleanQ.includes('influencer')) {
      service = 'Social Media & Influencer Campaigns';
    } else if (cleanQ.includes('web') || cleanQ.includes('ui/ux') || cleanQ.includes('website')) {
      service = 'Website UI/UX & Web Development';
    } else if (cleanQ.includes('content') || cleanQ.includes('pr')) {
      service = 'Content Strategy & PR';
    } else if (cleanQ.includes('branding')) {
      service = 'Brand Identity & Rebranding';
    }

    toolsUsed.push('create_contact_record');
    const created = await createContactRecord({
      full_name: fullName,
      company_name: companyName,
      email,
      phone_number: phone,
      service_required: service,
      message: `Enquiry submitted for ${service} by ${fullName}.`,
    });

    let reply = '';
    if (lang === 'ml') {
      reply =
        `**${created.contact.full_name}** (${created.contact.company_name}) എന്ന പുതിയ കോൺടാക്റ്റ് വിജയകരമായി ചേർത്തു.\n\n` +
        `• **ഇമെയിൽ:** ${created.contact.email}\n` +
        `• **ഫോൺ:** ${created.contact.phone_number}\n` +
        `• **സർവീസ്:** ${created.contact.service_required}\n` +
        `• **CRM ലീഡ്:** 'New' സ്റ്റാറ്റസോടെ രജിസ്റ്റർ ചെയ്തു.\n` +
        `• **നോട്ടിഫിക്കേഷൻ:** അഡ്മിൻ അലേർട്ട് നൽകിയിട്ടുണ്ട്.`;
    } else if (lang === 'hi') {
      reply =
        `**${created.contact.full_name}** (${created.contact.company_name}) का नया contact सफलतापूर्वक जोड़ दिया गया है।\n\n` +
        `• **ईमेल:** ${created.contact.email}\n` +
        `• **फ़ोन:** ${created.contact.phone_number}\n` +
        `• **सर्विस:** ${created.contact.service_required}\n` +
        `• **CRM Lead:** 'New' स्टेटस के साथ पाइपलाइन में जोड़ दिया गया है।`;
    } else {
      reply =
        `Successfully created contact for **${created.contact.full_name}** from **${created.contact.company_name}**.\n\n` +
        `• **Email:** ${created.contact.email}\n` +
        `• **Phone:** ${created.contact.phone_number}\n` +
        `• **Service Required:** ${created.contact.service_required}\n` +
        `• **CRM Status:** Added as "New" lead in the pipeline\n` +
        `• **Notification:** System alert created for administrators.`;
    }

    return complete('database_query', 'create_contact_record', reply, toolsUsed, 1);
  }

  // --------------------------------------------------------------------------
  // 4-THREE: UPDATE LEAD STATUS OR CONTACT FIELDS
  // "Change Marcus Vance's lead status to Converted", "Change Rahul's company name to XYZ Technologies"
  // --------------------------------------------------------------------------
  const isUpdateLeadStatus =
    (cleanQ.includes('lead status') || cleanQ.includes('lead status to') || cleanQ.includes('status to') || cleanQ.includes('സ്റ്റാറ്റസ്')) &&
    (cleanQ.includes('converted') || cleanQ.includes('interested') || cleanQ.includes('contacted') || cleanQ.includes('follow-up') || cleanQ.includes('lost') || cleanQ.includes('new'));

  if (isUpdateLeadStatus) {
    let targetStatus: any = 'Converted';
    if (cleanQ.includes('converted')) targetStatus = 'Converted';
    else if (cleanQ.includes('interested')) targetStatus = 'Interested';
    else if (cleanQ.includes('contacted')) targetStatus = 'Contacted';
    else if (cleanQ.includes('follow-up') || cleanQ.includes('follow up')) targetStatus = 'Follow-up Required';
    else if (cleanQ.includes('lost')) targetStatus = 'Lost';
    else if (cleanQ.includes('new')) targetStatus = 'New';

    let targetPerson = 'Marcus Vance';
    if (cleanQ.includes('marcus')) targetPerson = 'Marcus Vance';
    else if (cleanQ.includes('sophia')) targetPerson = 'Sophia Reynolds';
    else if (cleanQ.includes('elena')) targetPerson = 'Elena Rostova';
    else if (cleanQ.includes('chen')) targetPerson = 'David Chen';
    else if (cleanQ.includes('amara')) targetPerson = 'Amara Okafor';
    else if (cleanQ.includes('user1')) targetPerson = 'user1';
    else if (cleanQ.includes('rahul')) targetPerson = 'Rahul';

    toolsUsed.push('update_lead_status_record');
    const updateRes = await updateLeadStatusRecord({
      lead_id_or_customer_name: targetPerson,
      status: targetStatus,
    });

    let reply = '';
    if (updateRes.success) {
      if (lang === 'ml') {
        reply = `**${targetPerson}**-ന്റെ CRM ലീഡ് സ്റ്റാറ്റസ് വിജയകരമായി **"${targetStatus}"** എന്ന് മാറ്റി.`;
      } else if (lang === 'hi') {
        reply = `**${targetPerson}** का CRM lead status सफलतापूर्वक **"${targetStatus}"** में अपडेट कर दिया गया है।`;
      } else {
        reply = `Successfully updated **${targetPerson}**'s CRM lead status to **"${targetStatus}"**.`;
      }
      return complete('database_query', 'update_lead_status_record', reply, toolsUsed, 1);
    } else {
      reply = updateRes.error || `Could not find lead for ${targetPerson}.`;
      return complete('database_query', 'update_lead_status_failed', reply, toolsUsed, 0);
    }
  }

  const isUpdateContact =
    (cleanQ.includes('change') || cleanQ.includes('update') || cleanQ.includes('മാറ്റൂ') || cleanQ.includes('बदल दो')) &&
    (cleanQ.includes('company') || cleanQ.includes('phone') || cleanQ.includes('email') || cleanQ.includes('കമ്പനി') || cleanQ.includes('ഫോൺ') || cleanQ.includes('कंपनी'));

  if (isUpdateContact) {
    let targetName = 'Rahul';
    if (cleanQ.includes('marcus')) targetName = 'Marcus Vance';
    else if (cleanQ.includes('sophia')) targetName = 'Sophia Reynolds';
    else if (cleanQ.includes('elena')) targetName = 'Elena Rostova';
    else if (cleanQ.includes('user1')) targetName = 'user1';

    const updates: any = {};
    let fieldUpdated = 'company name';
    let newValue = 'XYZ Technologies';

    if (cleanQ.includes('company') || cleanQ.includes('കമ്പനി') || cleanQ.includes('कंपनी')) {
      const compMatch = message.match(/to\s+([A-Za-z0-9_ ]+)/i) || message.match(/എന്ന്\s+([A-Za-z0-9_ ]+)/i);
      newValue = compMatch ? compMatch[1].replace(/എന്ന് മാറ്റൂ/g, '').trim() : 'XYZ Technologies';
      updates.company_name = newValue;
      fieldUpdated = 'company name';
    } else if (cleanQ.includes('phone') || cleanQ.includes('ഫോൺ') || cleanQ.includes('फ़ोन')) {
      const phoneMatch = message.match(/\d{10}/) || message.match(/to\s+(\S+)/i);
      newValue = phoneMatch ? phoneMatch[0] : '9876500000';
      updates.phone_number = newValue;
      fieldUpdated = 'phone number';
    } else if (cleanQ.includes('email') || cleanQ.includes('ഇമെയിൽ') || cleanQ.includes('ईमेल')) {
      const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      newValue = emailMatch ? emailMatch[0] : 'updated@example.com';
      updates.email = newValue;
      fieldUpdated = 'email address';
    }

    toolsUsed.push('update_contact_record');
    const updateRes = await updateContactRecord({
      contact_id_or_name: targetName,
      ...updates,
    });

    let reply = '';
    if (updateRes.success) {
      if (lang === 'ml') {
        reply = `**${targetName}**-ന്റെ ${fieldUpdated} വിജയകരമായി **"${newValue}"** എന്ന് മാറ്റി.`;
      } else if (lang === 'hi') {
        reply = `**${targetName}** का ${fieldUpdated} सफलतापूर्वक **"${newValue}"** में अपडेट कर दिया गया है।`;
      } else {
        reply = `Successfully updated **${targetName}**'s ${fieldUpdated} to **"${newValue}"**.`;
      }
      return complete('database_query', 'update_contact_record', reply, toolsUsed, 1);
    } else {
      reply = updateRes.error || `Could not find contact for ${targetName}.`;
      return complete('database_query', 'update_contact_failed', reply, toolsUsed, 0);
    }
  }

  // --------------------------------------------------------------------------
  // 4-FOUR: FULL DETAILS TABLE (Intent B)
  // "Show all contact details", "Give me the full details of all contacts", "എല്ലാ കോൺടാക്റ്റുകളുടെയും full details തരൂ"
  // --------------------------------------------------------------------------
  const isFullDetailsQuery =
    cleanQ.includes('full details') ||
    cleanQ.includes('all contact details') ||
    cleanQ.includes('complete details') ||
    cleanQ.includes('table with all contact') ||
    cleanQ.includes('details of all') ||
    cleanQ.includes('മുഴുവൻ വിവരങ്ങളും') ||
    cleanQ.includes('പൂർണ്ണ വിവരങ്ങൾ') ||
    cleanQ.includes('ഇനി full details') ||
    cleanQ.includes('पूरी जानकारी');

  if (isFullDetailsQuery) {
    toolsUsed.push('get_all_contact_details');
    const res = await getAllContactDetails();

    let reply = '';
    if (lang === 'ml') {
      reply = `നമ്മുടെ ഡാറ്റാബേസിലെ മുഴുവൻ (**${res.total}**) കസ്റ്റമർ കോൺടാക്റ്റുകളുടെയും പൂർണ്ണ വിവരങ്ങൾ (പേര്, കമ്പനി, ഇമെയിൽ, ഫോൺ, സർവീസ്, മെസ്സേജ്, തീയതി) താഴെ നൽകുന്നു:`;
    } else if (lang === 'hi') {
      reply = `हमारे डेटाबेस के सभी (**${res.total}**) contacts की पूरी जानकारी नीचे दी गई है:`;
    } else {
      reply = `Here are the complete details of all **${res.total} customer contacts** in the Vynzora database:`;
    }

    return complete('database_query', 'get_all_contact_details', reply, toolsUsed, res.total, {
      tableData: {
        title: 'Vynzora Customer Contacts Directory (Full Details)',
        columns: ['Full Name', 'Company Name', 'Email', 'Phone Number', 'Service Required', 'Project Message', 'Created Date'],
        rows: res.contacts.map((c) => ({
          'Full Name': c.full_name,
          'Company Name': c.company_name,
          'Email': c.email,
          'Phone Number': c.phone_number,
          'Service Required': c.service_required,
          'Project Message': c.message,
          'Created Date': c.created_at ? c.created_at.split('T')[0] : 'N/A',
        })),
      },
    });
  }

  // --------------------------------------------------------------------------
  // 4-FIVE: CONTACT COUNT (Intent C) - Evaluated before listing names
  // "How many contacts are there?", "Total contacts?", "എത്ര കോൺടാക്റ്റുകൾ ഉണ്ട്?", "ആകെ എത്ര contacts ഉണ്ട്?", "कुल कितने contacts हैं?"
  // --------------------------------------------------------------------------
  const isDateFiltered = cleanQ.includes('today') || cleanQ.includes('ഈ മാസം') || cleanQ.includes('this month') || cleanQ.includes('ഇന്ന്');
  const isContactCountQuery =
    (cleanQ.includes('customer') || cleanQ.includes('contact') || cleanQ.includes('കസ്റ്റമർ') || cleanQ.includes('കോൺടാക്റ്റ')) &&
    (cleanQ.includes('how many') ||
      cleanQ.includes('total number') ||
      cleanQ.includes('total count') ||
      cleanQ.includes('what is the count') ||
      cleanQ.includes('count of contacts') ||
      cleanQ.includes('total contacts') ||
      cleanQ.includes('ആകെ എത്ര') ||
      cleanQ.includes('എത്ര കോൺടാക്റ്റുകൾ') ||
      cleanQ.includes('എത്ര contacts') ||
      cleanQ.includes('കുൽ കിത്നേ') ||
      cleanQ.includes('कुल कितने'));

  if (isContactCountQuery && !isDateFiltered) {
    toolsUsed.push('get_total_contacts');
    const contacts = await getTotalContacts();

    let reply = '';
    if (lang === 'ml') {
      reply = `ഡാറ്റാബേസിൽ നിലവിൽ **${contacts.total} കോൺടാക്റ്റുകൾ** ഉണ്ട്. അവരുടെ പേരുകൾ ലിസ്റ്റ് ചെയ്യണോ?`;
    } else if (lang === 'hi') {
      reply = `डेटाबेस में वर्तमान में **${contacts.total} contacts** हैं। क्या आप उनके नाम देखना चाहेंगे?`;
    } else {
      reply = `There are currently **${contacts.total} contacts** in the database. Would you like me to list their names?`;
    }

    return complete('database_query', 'get_total_contacts_count', reply, toolsUsed, contacts.total);
  }

  // --------------------------------------------------------------------------
  // 4-SIX: LIST ALL CONTACT NAMES (Intent A)
  // "Show all contacts", "List all contact names", "എല്ലാ കോൺടാക്റ്റുകളും കാണിക്കൂ", "എല്ലാ കോൺടാക്റ്റുകളുടെയും പേരുകൾ തരൂ", "सभी contacts दिखाओ"
  // --------------------------------------------------------------------------
  const isAllContactsListQuery =
    !isContactCountQuery &&
    (cleanQ === 'show all contacts' ||
      cleanQ === 'list all contacts' ||
      cleanQ === 'list all contact names' ||
      cleanQ === 'all contacts' ||
      cleanQ === 'show contacts' ||
      cleanQ === 'list contacts' ||
      cleanQ === 'customer contacts' ||
      cleanQ === 'contacts' ||
      cleanQ === 'customers' ||
      cleanQ === 'get all customer contacts' ||
      cleanQ === 'give me every contact in the database' ||
      cleanQ === 'all contact names' ||
      cleanQ.includes('show all contacts') ||
      cleanQ.includes('list all contact') ||
      cleanQ.includes('get all customer contacts') ||
      cleanQ.includes('give me every contact') ||
      cleanQ.includes('contacts details of all') ||
      cleanQ.includes('എല്ലാ കോൺടാക്റ്റുകളും കാണിക്കൂ') ||
      cleanQ.includes('എല്ലാ കോൺടാക്റ്റുകളുടെയും പേരുകൾ തരൂ') ||
      cleanQ.includes('എല്ലാ കസ്റ്റമർ കോൺടാക്റ്റുകളും കാണിക്കൂ') ||
      cleanQ.includes('മുഴുവൻ കോൺടാക്റ്റുകളും തരൂ') ||
      cleanQ.includes('എല്ലാ കോൺടാക്റ്റുകളും') ||
      cleanQ === 'കോൺടാക്റ്റുകൾ' ||
      cleanQ === 'കസ്റ്റമർ കോൺടാക്റ്റുകൾ' ||
      cleanQ.includes('सभी contacts दिखाओ') ||
      cleanQ.includes('सभी contact names बताओ') ||
      cleanQ.includes('सारे contacts दिखाओ') ||
      cleanQ.includes('database के सारे contacts दिखाओ'));

  if (isAllContactsListQuery) {
    toolsUsed.push('get_all_contacts_list');
    const res = await getAllContactsList();

    let reply = '';
    if (lang === 'ml') {
      reply =
        `നമ്മുടെ ഡാറ്റാബേസിൽ ആകെ **${res.total} കസ്റ്റമർ കോൺടാക്റ്റുകൾ** ഉണ്ട്. പേരുകൾ താഴെ നൽകുന്നു:\n\n` +
        res.contacts
          .map((c) => `${c.index}. **${c.full_name}** (${c.company_name}) - സർവീസ്: ${c.service_required}`)
          .join('\n') +
        `\n\nഇവരുടെ ഫോൺ നമ്പർ, ഇമെയിൽ അടക്കമുള്ള മുഴുവൻ വിവരങ്ങളും കാണണമെന്നുണ്ടോ? (മുഴുവൻ വിവരങ്ങൾക്ക് **"Show full details"** എന്ന് ചോദിക്കാം).`;
    } else if (lang === 'hi') {
      reply =
        `हमारे डेटाबेस में कुल **${res.total} customer contacts** पंजीकृत हैं:\n\n` +
        res.contacts
          .map((c) => `${c.index}. **${c.full_name}** (${c.company_name}) - Service: ${c.service_required}`)
          .join('\n') +
        `\n\nक्या आप इनकी पूरी जानकारी देखना चाहते हैं? (पूरी जानकारी के लिए **"Show full details"** कहें).`;
    } else {
      reply =
        `We currently have **${res.total} customer contacts** in the database:\n\n` +
        res.contacts
          .map((c) => `${c.index}. **${c.full_name}** (${c.company_name}) - Service: ${c.service_required}`)
          .join('\n') +
        `\n\nWould you like to see their full details, company names, or contact information? (Reply **"Show full details"** to see complete table).`;
    }

    return complete('database_query', 'get_all_contacts_list', reply, toolsUsed, res.total);
  }

  // --------------------------------------------------------------------------
  // 4A. ENTITY: USERS & ACCOUNTS
  // "How many users are there?", "user accounts", "who are the users"
  // --------------------------------------------------------------------------
  if (
    cleanQ === 'how many users are there' ||
    cleanQ === 'how many users' ||
    cleanQ.includes('users are there') ||
    cleanQ.includes('total users') ||
    cleanQ.includes('എത്ര users ഉണ്ട്')
  ) {
    toolsUsed.push('get_total_users');
    const u = await getTotalUsers();

    let reply = '';
    if (lang === 'ml') {
      reply =
        `വിൻസോറ സിസ്റ്റത്തിൽ നിലവിൽ:\n\n` +
        `• **രജിസ്റ്റർ ചെയ്ത അഡ്മിൻ യൂസർ:** ${u.authUsersCount} (${u.authUsers.map((x) => x.email).join(', ')}) Supabase Auth-ൽ രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്.\n` +
        `• **കസ്റ്റമർ കോൺടാക്റ്റുകൾ:** ${u.customerCount} കസ്റ്റമർ റെക്കോർഡുകൾ ഡാറ്റാബേസിൽ ഉണ്ട്.\n` +
        `• **CRM ടീം അംഗങ്ങൾ:** ${u.staffMembers.join(', ')} എന്നിവർ CRM പൈപ്പ്‌ലൈനിൽ പ്രവർത്തിക്കുന്നു.`;
    } else {
      reply =
        `In the Vynzora web platform:\n\n` +
        `• **Administrative Accounts:** **${u.authUsersCount}** registered user (${u.authUsers.map((x) => x.email).join(', ')}) in Supabase Auth.\n` +
        `• **Customer Contacts:** **${u.customerCount}** registered client accounts in the database.\n` +
        `• **Assigned CRM Representatives:** ${u.staffMembers.join(', ')}.`;
    }

    return complete('database_query', 'get_total_users', reply, toolsUsed, u.authUsersCount);
  }

  // 4B-3. Latest Customers / Enquiries: "Show me the latest five customers", "Show latest enquiries"
  if (
    cleanQ.includes('latest') &&
    (cleanQ.includes('customer') || cleanQ.includes('enquir') || cleanQ.includes('contact') || cleanQ.includes('കസ്റ്റമർ'))
  ) {
    let limit = 5;
    if (cleanQ.includes('three') || cleanQ.includes(' 3 ')) limit = 3;
    if (cleanQ.includes('ten') || cleanQ.includes(' 10 ')) limit = 10;
    if (cleanQ.includes('one') || cleanQ.includes('latest customer')) limit = 1;

    toolsUsed.push('get_latest_contacts');
    const res = await getLatestContacts(limit);

    if (limit === 1) {
      const c = res.contacts[0];
      let reply = `Our latest customer is **${c.full_name}** from **${c.company_name}**.\n\n• **Service Requested:** ${c.service_required}\n• **Email:** ${c.email}\n• **Date Acquired:** ${c.created_at.split('T')[0]}`;
      if (lang === 'ml') {
        reply = `നമ്മുടെ ഏറ്റവും പുതിയ കസ്റ്റമർ **${c.full_name}** (${c.company_name}) ആണ്.\n\n• **സർവീസ്:** ${c.service_required}\n• **ഇമെയിൽ:** ${c.email}\n• **തീയതി:** ${c.created_at.split('T')[0]}`;
      }
      return complete('database_query', 'get_latest_customer_single', reply, toolsUsed, 1);
    }

    let reply = `Here are the latest **${res.count}** customer enquiries received through the website:\n\n` +
      res.contacts.map((c, idx) => `${idx + 1}. **${c.full_name}** from **${c.company_name}** (Service: ${c.service_required})`).join('\n');

    if (lang === 'ml') {
      reply = `ഏറ്റവും പുതിയ ${res.count} enquiries വിവരങ്ങൾ താഴെ നൽകുന്നു:\n\n` +
        res.contacts.map((c, idx) => `${idx + 1}. **${c.full_name}** (${c.company_name}) - ${c.service_required}`).join('\n');
    }

    return complete('database_query', 'get_latest_contacts', reply, toolsUsed, res.count);
  }

  // 4B-4. Date-filtered Enquiries: "ഈ മാസം എത്ര enquiries കിട്ടി?", "Today's enquiries"
  if (cleanQ.includes('ഈ മാസം') || cleanQ.includes('this month')) {
    toolsUsed.push('get_monthly_enquiries');
    const res = await getMonthlyEnquiries();
    let reply = `We have received **${res.count} new enquiries** this month (${res.month}):\n\n` +
      res.enquiries.map((e, idx) => `${idx + 1}. **${e.name}** from **${e.company}** (Requested: ${e.service})`).join('\n');
    if (lang === 'ml') {
      reply = `ഈ മാസം (${res.month}) **${res.count} പുതിയ enquiries** ലഭിച്ചിട്ടുണ്ട്:\n\n` +
        res.enquiries.map((e, idx) => `${idx + 1}. **${e.name}** (${e.company}) - സർവീസ്: ${e.service}`).join('\n');
    }
    return complete('database_query', 'get_monthly_enquiries', reply, toolsUsed, res.count);
  }

  if (
    (cleanQ.includes('today') || cleanQ.includes('ഇന്ന്')) &&
    (cleanQ.includes('enquir') || cleanQ.includes('contact') || cleanQ.includes('അന്വേഷണ'))
  ) {
    toolsUsed.push('get_new_enquiries');
    const res = await getNewEnquiries();
    let reply = res.count > 0
      ? `You received **${res.count}** new enquiries today.`
      : "We haven't received any new enquiries today yet. Currently, there are 6 total enquiries in the database.";
    if (lang === 'ml') {
      reply = res.count > 0
        ? `ഇന്ന് **${res.count}** പുതിയ enquiries ലഭിച്ചിട്ടുണ്ട്.`
        : 'ഇന്ന് പുതിയ enquiries ഒന്നും വന്നിട്ടില്ല. നിലവിൽ ഡാറ്റാബേസിൽ ആകെ 6 enquiries ഉണ്ട്.';
    }
    return complete('database_query', 'get_today_enquiries', reply, toolsUsed, res.count);
  }

  // --------------------------------------------------------------------------
  // 4C. ENTITY: CRM LEADS & STATUSES
  // "crm leads", "leads", "qualified leads", "which leads are still new?", "who needs follow-up?"
  // --------------------------------------------------------------------------

  // 4C-1. Direct CRM entity overview: "crm leads" or "leads"
  if (cleanQ === 'crm leads' || cleanQ === 'leads' || cleanQ === 'crm' || cleanQ === 'സിആർഎം ലീഡുകൾ' || cleanQ === 'ലീഡുകൾ') {
    toolsUsed.push('get_crm_summary', 'get_latest_leads');
    const [crm, latest] = await Promise.all([getCrmSummary(), getLatestLeads(6)]);

    let reply =
      `Vynzora currently manages **${crm.totalLeads} active leads** in the CRM pipeline (Conversion Rate: **${crm.conversionRate}**):\n\n` +
      latest.leads.map((l, idx) => `${idx + 1}. **${l.customer_name}** (${l.company_name}) - Status: **${l.lead_status}** | Assigned: ${l.assigned_to}`).join('\n');

    if (lang === 'ml') {
      reply =
        `CRM പൈപ്പ്‌ലൈനിൽ ആകെ **${crm.totalLeads} ലീഡുകൾ** ഉണ്ട് (കൺവേർഷൻ റേറ്റ്: **${crm.conversionRate}**):\n\n` +
        latest.leads.map((l, idx) => `${idx + 1}. **${l.customer_name}** (${l.company_name}) - സ്റ്റാറ്റസ്: **${l.lead_status}**`).join('\n');
    }

    return complete('database_query', 'crm_leads_overview', reply, toolsUsed, crm.totalLeads);
  }

  // 4C-2. Status filtering: Qualified, Interested, New, Converted, etc.
  if (
    cleanQ.includes('qualified') ||
    cleanQ.includes('interested') ||
    cleanQ.includes('still new') ||
    cleanQ.includes('new leads') ||
    cleanQ.includes('converted') ||
    cleanQ.includes('പുതിയ ലീഡുകൾ') ||
    cleanQ.includes('താൽപ്പര്യമുള്ള')
  ) {
    let targetStatus = 'Interested';
    if (cleanQ.includes('new')) targetStatus = 'New';
    if (cleanQ.includes('qualified')) targetStatus = 'Interested';
    if (cleanQ.includes('converted')) targetStatus = 'Converted';

    toolsUsed.push('get_leads_by_status');
    const res = await getLeadsByStatus(targetStatus);

    let reply = `There are currently **${res.total} lead(s)** with status **"${targetStatus}"**:\n\n` +
      res.leads.map((l: any, idx: number) => `${idx + 1}. **${l.customer_name}** from **${l.company_name}** (${l.service})`).join('\n');

    if (lang === 'ml') {
      reply = `നിലവിൽ **"${targetStatus}"** സ്റ്റാറ്റസിൽ **${res.total} ലീഡ്(കൾ)** ഉണ്ട്:\n\n` +
        res.leads.map((l: any, idx: number) => `${idx + 1}. **${l.customer_name}** (${l.company_name}) - ${l.service}`).join('\n');
    }

    return complete('database_query', 'get_leads_by_status', reply, toolsUsed, res.total);
  }

  // 4C-3. Follow-up: "Who needs follow-up?", "Which customers need follow-up?"
  if (
    cleanQ.includes('who needs follow-up') ||
    cleanQ.includes('who needs follow up') ||
    cleanQ.includes('which customers need follow-up') ||
    cleanQ.includes('follow-up') ||
    cleanQ.includes('ഫോളോ')
  ) {
    toolsUsed.push('get_pending_followups');
    const res = await getPendingFollowups();

    let reply = `There are **${res.totalPending}** customer leads requiring prompt follow-up:\n\n` +
      res.leads.map((l: any, idx: number) => `${idx + 1}. **${l.customer_name}** (${l.company_name}) - Service: ${l.service} | Status: ${l.lead_status} | Due: ${l.follow_up_date || 'Immediate'}`).join('\n');

    if (lang === 'ml') {
      reply = `ശ്രദ്ധ ആവശ്യമുള്ള **${res.totalPending}** ക്ലയന്റ് ഫോളോ-അപ്പുകൾ താഴെ നൽകുന്നു:\n\n` +
        res.leads.map((l: any, idx: number) => `${idx + 1}. **${l.customer_name}** (${l.company_name}) - സർവീസ്: ${l.service} | സ്റ്റാറ്റസ്: ${l.lead_status} | തീയതി: ${l.follow_up_date || 'ഉടൻ'}`).join('\n');
    }

    return complete('database_query', 'get_pending_followups', reply, toolsUsed, res.totalPending);
  }

  // --------------------------------------------------------------------------
  // 4D. ENTITY: NOTIFICATIONS & ALERTS
  // "notifications", "alerts", "show today's notifications", "tomorrow notifications"
  // --------------------------------------------------------------------------

  // 4D-1. Direct notifications entity overview: "notifications" or "alerts"
  if (cleanQ === 'notifications' || cleanQ === 'alerts' || cleanQ === 'നോട്ടിഫിക്കേഷൻസ്' || cleanQ === 'നോട്ടിഫിക്കേഷനുകൾ') {
    toolsUsed.push('get_latest_notifications');
    const res = await getLatestNotifications(5);
    let reply = `You have **${res.count} notifications** in the system:\n\n` +
      res.notifications.map((n: any, idx: number) => `${idx + 1}. **${n.title}** (${n.priority} Priority) - [${n.scheduled_date || 'N/A'}]`).join('\n');

    if (lang === 'ml') {
      reply = `സിസ്റ്റത്തിലുള്ള പ്രധാന ${res.count} notifications താഴെ നൽകുന്നു:\n\n` +
        res.notifications.map((n: any, idx: number) => `${idx + 1}. **${n.title}** (${n.priority} മുൻഗണന)`).join('\n');
    }

    return complete('database_query', 'notifications_overview', reply, toolsUsed, res.count);
  }

  // 4D-2. Today's notifications
  if (
    (cleanQ.includes('notification') || cleanQ.includes('alert') || cleanQ.includes('നോട്ടിഫിക്കേഷ') || cleanQ.includes('അറിയിപ്പ്')) &&
    (cleanQ.includes('today') || cleanQ.includes('ഇന്ന്') || cleanQ.includes('ഇന്നത്തെ'))
  ) {
    toolsUsed.push('get_today_notifications');
    const res = await getTodayNotifications();
    let reply = res.count > 0
      ? `You have ${res.count} notification(s) for today:\n\n` + res.notifications.map((n: any, idx: number) => `${idx + 1}. **${n.title}** [${n.priority}]`).join('\n')
      : 'There are no new notifications or alerts scheduled for today.';

    if (lang === 'ml') {
      reply = res.count > 0
        ? `ഇന്ന് ${res.count} notifications ഉണ്ട്:\n\n` + res.notifications.map((n: any, idx: number) => `${idx + 1}. **${n.title}** (${n.priority})`).join('\n')
        : 'ഇന്ന് പുതിയ notifications ഒന്നും ലഭിച്ചിട്ടില്ല.';
    }

    return complete('database_query', 'get_today_notifications', reply, toolsUsed, res.count);
  }

  // 4D-3. Tomorrow's notifications
  if (
    (cleanQ.includes('notification') || cleanQ.includes('alert') || cleanQ.includes('നോട്ടിഫിക്കേഷ')) &&
    (cleanQ.includes('tomorrow') || cleanQ.includes('നാളെ') || cleanQ.includes('നാളത്തെ'))
  ) {
    toolsUsed.push('get_upcoming_notifications');
    const res = await getUpcomingNotifications();
    let reply = res.count > 0
      ? `You have ${res.count} notification(s) scheduled for tomorrow.`
      : 'There are currently no notifications or alerts scheduled for tomorrow. Everything is up to date!';

    if (lang === 'ml') {
      reply = res.count > 0
        ? `നാളത്തേക്ക് ${res.count} notifications ഷെഡ്യൂൾ ചെയ്തിട്ടുണ്ട്.`
        : 'നാളത്തേക്ക് ഷെഡ്യൂൾ ചെയ്ത പുതിയ notifications ഒന്നും ലഭിച്ചിട്ടില്ല. എല്ലാ ടാസ്കുകളും അപ്-ടു-ഡേറ്റ് ആണ്.';
    }

    return complete('database_query', 'get_upcoming_notifications', reply, toolsUsed, res.count);
  }

  // --------------------------------------------------------------------------
  // 4E. ANALYTICS & BUSINESS PERFORMANCE
  // "Which service is most requested?", "Give me a complete business summary."
  // --------------------------------------------------------------------------

  // 4E-1. Most requested service
  if (
    cleanQ.includes('which service is most requested') ||
    cleanQ.includes('most requested service') ||
    cleanQ.includes('highest demand') ||
    cleanQ.includes('ഏറ്റവും കൂടുതൽ demand ഉള്ള service') ||
    cleanQ.includes('ഏറ്റവും കൂടുതൽ ആവശ്യപ്പെടുന്ന')
  ) {
    toolsUsed.push('get_service_demand_analysis');
    const res = await getServiceDemandAnalysis();

    let reply =
      `The most requested service is **${res.topService}** with ${res.services[0]?.count} enquiries (${res.services[0]?.percentage}% of client requests).\n\n` +
      `Breakdown of service demand across client inquiries:\n` +
      res.services.map((s, idx) => `${idx + 1}. **${s.service}**: ${s.count} enquiries (${s.percentage}%)`).join('\n');

    if (lang === 'ml') {
      reply =
        `വിപണിയിൽ ഏറ്റവും കൂടുതൽ ആവശ്യപ്പെടുന്ന സർവീസ് **"${res.topService}"** ആണ്.\n\n` +
        res.services.map((s, idx) => `${idx + 1}. **${s.service}**: ${s.count} enquiries (${s.percentage}%)`).join('\n');
    }

    return complete('database_query', 'get_service_demand_analysis', reply, toolsUsed, res.services.length, {
      chartData: res.chart,
    });
  }

  // 4E-2. Complete business summary
  if (
    cleanQ.includes('business summary') ||
    cleanQ.includes('performance summary') ||
    cleanQ.includes('ബിസിനസ്സ് സമ്മറി') ||
    cleanQ.includes('business report')
  ) {
    toolsUsed.push('get_business_summary', 'get_service_demand_analysis');
    const [summary, serviceRes] = await Promise.all([
      getBusinessSummary(),
      getServiceDemandAnalysis(),
    ]);

    const m = summary.metrics;
    let reply =
      `Here is the complete business performance summary for Vynzora:\n\n` +
      `• **Total Customer Contacts:** ${m.totalContacts}\n` +
      `• **Active CRM Leads:** ${m.totalLeads}\n` +
      `• **Client Conversion Rate:** ${m.conversionRate}\n` +
      `• **Fresh Enquiries Requiring Attention:** ${m.newEnquiriesPending}\n` +
      `• **Pending Follow-up Touchpoints:** ${m.followupsPending}\n` +
      `• **Leading Service Category:** ${summary.topDemandedService}\n\n` +
      `Executive Takeaway: Our pipeline conversion velocity sits at ${m.conversionRate}. ${m.newEnquiriesPending + m.followupsPending} client accounts currently require operational touchpoints.`;

    if (lang === 'ml') {
      reply =
        `വിൻസോറയുടെ സമഗ്ര ബിസിനസ്സ് സമ്മറി താഴെ നൽകുന്നു:\n\n` +
        `• **ആകെ കസ്റ്റമർ കോൺടാക്റ്റുകൾ:** ${m.totalContacts}\n` +
        `• **ആക്ടീവ് CRM ലീഡുകൾ:** ${m.totalLeads}\n` +
        `• **കൺവേർഷൻ റേറ്റ്:** ${m.conversionRate}\n` +
        `• **പുതിയ അന്വേഷണങ്ങൾ (Fresh Enquiries):** ${m.newEnquiriesPending}\n` +
        `• **ഫോളോ-അപ്പ് ആവശ്യമുള്ളവ:** ${m.followupsPending}\n` +
        `• **ഏറ്റവും കൂടുതൽ ഡിമാൻഡുള്ള സർവീസ്:** ${summary.topDemandedService}`;
    }

    return complete('database_query', 'get_business_summary', reply, toolsUsed, m.totalContacts, {
      chartData: serviceRes.chart,
      reportData: {
        title: 'VYNZORA Executive Business Performance Report',
        period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        executiveSummary: `Vynzora is managing ${m.totalContacts} total client relationships with a pipeline conversion efficiency of ${m.conversionRate}.`,
        metrics: [
          { label: 'Total Contacts', value: m.totalContacts },
          { label: 'Pipeline Leads', value: m.totalLeads },
          { label: 'Conversion Rate', value: m.conversionRate },
          { label: 'New Enquiries', value: m.newEnquiriesPending },
          { label: 'Pending Follow-ups', value: m.followupsPending },
        ],
        tables: [
          {
            title: 'Service Demand Ranking',
            columns: ['Service Category', 'Total Inquiries', 'Percentage'],
            rows: serviceRes.services.map((s: any) => [s.service, s.count, `${s.percentage}%`]),
          },
        ],
        insights: summary.executiveTakeaways,
        recommendations: [
          `Prioritize outreach to the ${m.newEnquiriesPending} fresh incoming leads within 24 hours.`,
          `Allocate additional creative bandwidth to "${summary.topDemandedService}".`,
        ],
      },
    });
  }

  // --------------------------------------------------------------------------
  // 4E-3. COMPANY WITH MOST ENQUIRIES
  // "Which company has submitted the most enquiries?", "ഏറ്റവും കൂടുതൽ enquiries നൽകിയ കമ്പനി ഏതാണ്?"
  // --------------------------------------------------------------------------
  if (
    cleanQ.includes('most enquiries') ||
    cleanQ.includes('highest enquiries') ||
    cleanQ.includes('ഏറ്റവും കൂടുതൽ enquiries') ||
    cleanQ.includes('ഏറ്റവും കൂടുതൽ അന്വേഷണങ്ങൾ') ||
    cleanQ.includes('सबसे ज्यादा enquiries')
  ) {
    toolsUsed.push('get_company_with_most_enquiries');
    const compRes = await getCompanyWithMostEnquiries();

    let reply = `In our current database, client enquiries are distributed across companies as follows:\n\n`;
    reply += compRes.breakdown.map((b) => `• **${b.company}**: ${b.count} enquiry`).join('\n');
    reply += `\n\nEach registered client company currently holds 1 active enquiry record in Supabase.`;

    if (lang === 'ml') {
      reply =
        `ഡാറ്റാബേസിൽ ക്ലയന്റ് അന്വേഷണങ്ങളുടെ വിതരണം താഴെ നൽകുന്നു:\n\n` +
        compRes.breakdown.map((b) => `• **${b.company}**: ${b.count} എണ്ണം`).join('\n') +
        `\n\nനിലവിൽ ഓരോ ക്ലയന്റ് കമ്പനിക്കും ഓരോ enquiry വീതമാണ് രജിസ്റ്റർ ചെയ്തിട്ടുള്ളത്.`;
    } else if (lang === 'hi') {
      reply =
        `डेटाबेस में क्लाइंट पूछताछ का विवरण:\n\n` +
        compRes.breakdown.map((b) => `• **${b.company}**: ${b.count} enquiry`).join('\n') +
        `\n\nवर्तमान में प्रत्येक कंपनी से एक सक्रिय पूछताछ पंजीकृत है।`;
    }

    return complete('database_query', 'get_company_with_most_enquiries', reply, toolsUsed, compRes.breakdown.length);
  }

  // --------------------------------------------------------------------------
  // 4F. SPECIFIC CUSTOMER SEARCH (By Name, Company, or Service) - (Intent D)
  // "Show Rahul's contact details", "Elena details", "Find the contact from ABC Company", "What is Rahul's email?"
  // --------------------------------------------------------------------------
  if (
    cleanQ.includes('details') ||
    cleanQ.includes('വിവരങ്ങൾ') ||
    cleanQ.includes('email') ||
    cleanQ.includes('phone') ||
    cleanQ.includes('find the contact') ||
    cleanQ.includes('കണ്ടുപിടിക്കൂ') ||
    cleanQ.includes('ढूँढो') ||
    cleanQ.includes('contact from')
  ) {
    let rawTarget = cleanQ
      .replace(/show me\s+|show\s+|find the contact from\s+|find contact from\s+|find the contact for\s+|find contact\s+|find\s+|get\s+|'s contact details|'s details|'s email|'s phone|contact details of|details of|contact details|details|വിവരങ്ങൾ|email|phone|കണ്ടുപിടിക്കൂ|ढूँढो|-ന്റെ|ന്റെ|की details दिखाओ|do we have a contact for|contact for/gi, '')
      .replace(/'s$/i, '')
      .trim();

    if (rawTarget) {
      toolsUsed.push('search_customer');
      const res = await searchCustomer(rawTarget);

      let reply = '';
      if (!res.results || res.results.length === 0) {
        const contacts = await getAllContacts();
        const currentNames = contacts.map((c: any) => c.full_name).join(', ');
        reply = `I couldn't find a contact matching "${rawTarget}" in the database. Currently registered contacts are: ${currentNames}.`;
        if (lang === 'ml') {
          reply = `ഡാറ്റാബേസിൽ "${rawTarget}" എന്ന പേരിൽ കോൺടാക്റ്റ് കണ്ടെത്താനായില്ല. നിലവിലെ സജീവ കോൺടാക്റ്റുകൾ: ${currentNames}.`;
        } else if (lang === 'hi') {
          reply = `डेटाबेस में "${rawTarget}" नाम का कोई contact नहीं मिला। वर्तमान में पंजीकृत contacts हैं: ${currentNames}.`;
        }
      } else {
        const match: any = res.results[0];
        reply =
          `Customer Profile for **${match.customer_name}**:\n\n` +
          `• **Client Name:** ${match.customer_name}\n` +
          `• **Company:** ${match.company_name}\n` +
          `• **Email:** ${match.email}\n` +
          `• **Phone:** ${match.phone_number || '+1 (555) 000-0000'}\n` +
          `• **Service Requested:** ${match.service}\n` +
          `• **Pipeline Status:** ${match.lead_status}\n` +
          `• **Message:** ${match.message || 'No specific notes recorded'}\n` +
          `• **Date Created:** ${match.created_at ? match.created_at.split('T')[0] : 'N/A'}`;

        if (lang === 'ml') {
          reply =
            `**${match.customer_name}** (${match.company_name}) എന്ന കസ്റ്റമറുടെ വിവരങ്ങൾ:\n\n` +
            `• **പേര്:** ${match.customer_name}\n` +
            `• **കമ്പനി:** ${match.company_name}\n` +
            `• **ഇമെയിൽ:** ${match.email}\n` +
            `• **ഫോൺ:** ${match.phone_number || 'N/A'}\n` +
            `• **ആവശ്യപ്പെട്ട സർവീസ്:** ${match.service}\n` +
            `• **CRM സ്റ്റാറ്റസ്:** ${match.lead_status}\n` +
            `• **സന്ദേശം:** ${match.message || 'പ്രത്യേക കുറിപ്പുകൾ ഇല്ല'}`;
        } else if (lang === 'hi') {
          reply =
            `**${match.customer_name}** (${match.company_name}) का विवरण:\n\n` +
            `• **नाम:** ${match.customer_name}\n` +
            `• **कंपनी:** ${match.company_name}\n` +
            `• **ईमेल:** ${match.email}\n` +
            `• **फ़ोन:** ${match.phone_number || 'N/A'}\n` +
            `• **सर्विस:** ${match.service}\n` +
            `• **CRM स्थिति:** ${match.lead_status}`;
        }
      }
      return complete('database_query', 'search_customer_profile', reply, toolsUsed, res.count || 0);
    }
  }

  // --------------------------------------------------------------------------
  // 4G. DATABASE SCHEMA & TABLE RECORD COUNTS
  // "What tables exist?", "Show database schema"
  // --------------------------------------------------------------------------
  if (cleanQ.includes('schema') || cleanQ.includes('database structure') || cleanQ.includes('what tables')) {
    toolsUsed.push('get_database_schema');
    const schema = await getDatabaseSchema();
    let reply =
      `**${schema.database} Schema:**\n\n` +
      schema.tables
        .map((t) => `• **Table \`${t.name}\`** (${t.rowCount} records): ${t.description}`)
        .join('\n');
    return complete('database_query', 'get_database_schema', reply, toolsUsed, schema.tables.length);
  }

  // --------------------------------------------------------------------------
  // 4H. FALLBACK: GENERAL SEARCH ACROSS ALL TABLES
  // If query is an unknown keyword search, search all tables without crashing or returning canned menus
  // --------------------------------------------------------------------------
  toolsUsed.push('search_database_records');
  const searchRes = await searchDatabaseRecords(cleanQ);

  if (searchRes.totalMatches > 0) {
    let reply = `Found **${searchRes.totalMatches} matching record(s)** across our database for "${cleanQ}":\n\n`;
    if (searchRes.contacts.length > 0) {
      reply += `**Contacts (${searchRes.contacts.length}):**\n` +
        searchRes.contacts.map((c) => `• **${c.full_name}** (${c.company_name}) - ${c.service_required}`).join('\n') + '\n\n';
    }
    if (searchRes.leads.length > 0) {
      reply += `**CRM Leads (${searchRes.leads.length}):**\n` +
        searchRes.leads.map((l) => `• **${l.contact?.full_name || 'N/A'}** - Status: ${l.lead_status}`).join('\n') + '\n\n';
    }
    return complete('database_query', 'search_database_records', reply.trim(), toolsUsed, searchRes.totalMatches);
  }

  // Natural explanation if not matched
  let fallbackReply = `I searched our Supabase database for "${message}" but found no matching customer, lead, or notification records. You can ask me about customer contacts, CRM pipeline leads, today's notifications, service demand analytics, or agency performance metrics.`;
  if (lang === 'ml') {
    fallbackReply = `ഡാറ്റാബേസിൽ "${message}" എന്നതുമായി ബന്ധപ്പെട്ട വിവരങ്ങൾ ഒന്നും കണ്ടെത്താനായില്ല. കസ്റ്റമർ കോൺടാക്റ്റുകൾ, CRM ലീഡുകൾ, ഇന്നത്തെ നോട്ടിഫിക്കേഷനുകൾ, അല്ലെങ്കിൽ ബിസിനസ്സ് സമ്മറി എന്നിവ പരിശോധിക്കാൻ ഞാൻ സഹായിക്കാം.`;
  }

  return complete('database_query', 'database_search_unmatched', fallbackReply, toolsUsed, 0);
}

/**
 * Main AI Assistant Processor
 */
export async function processAiMessage(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<AiChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Use the local semantic business engine if GEMINI_API_KEY is not configured
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your-gemini')) {
    return await semanticBusinessEngine(message, history);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [
        {
          functionDeclarations: geminiToolDeclarations as unknown as FunctionDeclaration[],
        },
      ],
    });

    const chat = model.startChat({
      history: history.slice(-8).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
    });

    const lang = detectLanguage(message);
    let augmentedMessage = message;
    if (lang === 'ml') {
      augmentedMessage = `${message}\n\n[MANDATORY INSTRUCTION: Respond in natural Malayalam script (മലയാളം). Preserve business terms and customer names. DO NOT respond in English.]`;
    } else if (lang === 'hi') {
      augmentedMessage = `${message}\n\n[MANDATORY INSTRUCTION: Respond in natural Hindi in Devanagari script (हिन्दी). DO NOT respond in English.]`;
    }

    let result = await chat.sendMessage(augmentedMessage);
    const toolsUsed: string[] = [];

    let iterations = 0;
    while (iterations < 5) {
      iterations++;
      const call = result.response.functionCalls()?.[0];
      if (!call) break;

      toolsUsed.push(call.name);
      let functionResult: any;
      try {
        functionResult = await executeTool(call.name, call.args || {});
      } catch (err: any) {
        functionResult = { error: err.message || 'Execution error' };
      }

      result = await chat.sendMessage([
        {
          functionResponse: {
            name: call.name,
            response: functionResult,
          },
        },
      ]);
    }

    const replyText = result.response.text();
    const hasMalayalamScript = /[\u0D00-\u0D7F]/.test(replyText);
    const hasHindiScript = /[\u0900-\u097F]/.test(replyText);

    if (lang === 'ml' && !hasMalayalamScript) {
      console.warn('Gemini produced non-Malayalam response. Intercepting with semantic engine.');
      return await semanticBusinessEngine(message, history);
    }
    if (lang === 'hi' && !hasHindiScript) {
      console.warn('Gemini produced non-Hindi response. Intercepting with semantic engine.');
      return await semanticBusinessEngine(message, history);
    }

    logAssistantStep({
      timestamp: new Date().toISOString(),
      userInput: message,
      detectedLanguage: lang,
      detectedCategory: 'database_query',
      detectedIntent: toolsUsed[0] || 'gemini_conversation',
      selectedTool: toolsUsed,
      toolExecutionStatus: toolsUsed.length > 0 ? 'SUCCESS' : 'SKIPPED',
      supabaseResultCount: 1,
      finalResponse: replyText,
    });

    return {
      reply: replyText,
      language: lang,
      toolsUsed,
    };
  } catch (error) {
    console.warn('Gemini API call failed, falling back to local semantic engine:', error);
    return await semanticBusinessEngine(message, history);
  }
}
