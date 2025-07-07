exports.weekDayMap = {
  "Mon": "0e9c390d-04f1-494f-94e0-c5bf2bc4cbc7",
  "Tue": "f7b1f388-4d31-455a-9450-fed1e61d282c",
  "Wed": "2fd4fb6f-b90b-440e-9d39-ecda09edf820",
  "Thu": "fb89509c-3550-45f5-84d1-c67b542d1b5c",
  "Fri": "ee5fa415-97e3-4049-81f6-c08d181291f4",
};

exports.weekLabelMap = {
  "Week 1 (Remote)": "76c5d76b-fef1-4c11-b1da-5ef2c83e3902",
  "Week 2 (In Person)": "e7594be7-9bf8-4e94-a196-994c42b0bb68",
};

exports.subjectMap = {
  "Project Management": "8b48e618-7335-4689-8995-7ed2a7bb7753",
  "Measurement": "ea91ea5e-18a5-47e8-bdad-f99ab7804bec",
  "Process": "798368c7-fcf5-4699-8225-63855d343eec",
  "People": "d2f4dc86-ae96-4a40-8981-51393b89a9aa",
  "Brand MTKG": "107e7a9d-d934-4be1-abd6-36173c6c487e",
  "Discovery": "d0a90110-28f6-4754-ac1a-d3bb266b385a",
  "Vision, Mission, and Values": "8ce0b829-e0e3-4125-a099-9b5a868cc880",
  "Client Alignment & Project Control": "af5f180e-a176-441e-b05d-568292cf5d65",
  "LifeCycle": "143cd097-7b1f-48da-a7a2-ffa356520b9f",
  "Professional Services": "9c943f8a-abab-460e-ac50-bb5224acf565",
  "Introduction and Expectations": "e9b1c913-5551-4d62-8fd7-284e177ed457",
  "Role Playing": "7bb93ffb-3572-4ccc-80ef-4d474048b05b",
  "Feedback": "fbee9576-8fb2-4c1f-88fb-af867603847e",
  "Technical": "acba3867-af26-4ef5-baf5-b8d058be1139",
  "Live Dialing": "303519f2-4ea6-4c96-8574-f3d342d5c454",
};

exports.pillarMap = {
  "PM": "2ce4b0a0-0fab-4f4f-8b31-914e31825d8b",
  "Measurement": "26b7c101-bb24-4b6f-ae17-a27581a7f1e9",
  "People": "c95a1ee6-095f-4899-9bf2-05aae03b15de",
  "Operations": "9949058b-fe04-43c9-95cd-f6c85705eef6",
  "Biz Dev": "884bd05b-3179-4ca6-b36d-8c9438ddb41d",
  "Strategy": "11747e28-dd83-4820-a6f5-c8049afc65a3",
  "Internal": "0ef8d0a3-e51b-4486-ad0c-db5a6e2df358",
};

// Note: Market has too many options to include all here - will handle dynamically

// User name to ClickUp User ID mapping (actual ClickUp user IDs)
exports.userMap = {
  "Adam Williams": "12733340",
  "Tim Grabrovaz": "88266753", 
  "Pete Villari": "14962111",
  "Josh Bresler": "14888265",
  "Kai Hungerford": "6386026",
  "Ryland McClain-Rubin": "82243216",
  "Dakota Madison": "57093259",
  "Raul Ruiz": "63074987",
  "Billy Hardison": "57275114",
  "Rob Braiman": "10503985",
  "Joshua Harvey": "82212720",
  "Randi Rhinehardt": "10559257",
  "Isabelle Welch": "82247933",
  "Kaitlyn Tedder": "57161368",
  "CJ Johnson": "43000186",
  "SarahRose Mosh": "82229112",
  "Ronnie Blanton": "82294706",
  "Nathan Stone": "57220451",
  "Shane Wilson": "82251128",
  "Ethan Prehoda": "57036389",
  "Caleb Connerty": "6350449"
};

exports.personalityTagMap = {
  "Driver - Quick to Action, Confident, Not Detailed": "367887e1-3216-4475-a43a-67a50e4a8194",
  "Analytic - Perfectionist, Serious, Thoughtful": "7310b7fe-d11c-4040-8236-c208d76d784b",
  "Expressive - Charismatic, Talkative, Participatory": "dc080f16-48f0-418c-aea8-21f31dcee237",
  "Amiable - Easy Going, Patient, Inoffensive": "c2fb7a1c-560a-4d72-8fbb-4f5fc8fa195c",
  "Not Applicable": "a1df2769-e115-4425-8143-a0388b5a8da9",
};

/**
 * The unique IDs for the primary lists used in the report.
 */
exports.LIST_IDS = {
  CLASS_DETAILS: '901409267881',
  FEEDBACK_GRADES: '901409111922',
  SCHEDULE: '901409248233',
  ADMIN_TASKS: '901408951211', // Note: API access to fields is currently blocked
};

/**
 * A centralized map of all custom field IDs used in the project.
 * This makes it easy to reference fields without hardcoding IDs everywhere.
 */
exports.CUSTOM_FIELD_IDS = {
  // --- Fields from the "Class Details" List ---
  // We have confirmed these IDs by running the getFieldIds.js script.
  CLASS_DETAILS: {
    PD_ORIENTEE: 'fdd1f582-d61c-47ac-920d-72a1f0107d7e',
    WK_1_FEEDBACK: 'd478c2fc-acbf-4701-9600-91de798a0ea3',
    WK_2_FEEDBACK: 'a41d4e9a-bd5d-40c8-b6ca-829b97edf326',
    PILLAR: '6601dd3b-4bae-4cb7-a9c1-a24ef1ef07fb',
    PERSONALITY_TAG: '69347d12-00dd-4c2f-9a3d-547b76f370c6',
    COGENT_EMAIL: '49275d9f-0331-461e-afac-dd244549cce7',
    LINKEDIN_PROFILE: '10382f47-9eac-4d40-a6ba-cdb3fd6bf051',
    MARKET: '46e75424-1184-4121-96e1-9d433b26ce6b',
  },

  // --- Fields from the "Schedule" List ---
  // IDs confirmed by running getFieldIds.js.
  SCHEDULE: {
    LEADS: 'a6280fe4-06fb-4bde-bb98-ff104bf23531',
    WEEK_NUM: '9e27e1a7-b935-4274-839a-c18ca8d72b61',
    WEEK_DAY: 'b6766eaf-58b0-46a7-ad5a-031d9848c88f',
    SUBJECT: 'c80df80b-4f7e-4e4f-803d-b50d76fef6f2',
    RELEVANT_FILES: 'bbceb3eb-b908-4b24-8280-1e7377491e5f',
    SEND_INVITE: '13175b6f-5695-4a7b-8ae4-5de4dde59b1d',
    // CRITICAL: These are the actual timing fields ClickUp uses for display!
    DATE_TIME: '05ef80cd-d97c-491c-8699-f3f35c4418ce',
    ACTIVE_DATE: '8a428012-a9db-4e3b-8512-734d01c4d464',
  },

  // --- Fields from the "Feedback & Grades" List ---
  // IDs confirmed by running getFieldIds.js.
  FEEDBACK_GRADES: {
    PD_ORIENTEE: 'fdd1f582-d61c-47ac-920d-72a1f0107d7e',
    COMMENTS: '831407c1-8971-4ab4-8a23-29083fdcc09f',
    EFFORT: '9dafe855-0d64-4f6b-b66d-322e584e1316',
    COMP: '92275dfb-6ce2-418e-a8cd-0f74be70ddf7',
    APPLICATION: 'aab90257-fe00-4f08-89d6-d738277d1cb9',
    WEEK_NUM: '9e27e1a7-b935-4274-839a-c18ca8d72b61',
    WEEK_DAY: 'b6766eaf-58b0-46a7-ad5a-031d9848c88f',
    ASSIGNMENT: 'a2c1d0b4-7bef-40f4-9c64-b9e0e0f8da06',
    GRADE: 'f38b32e1-5420-4975-9375-7e0bd000afc7',
  },

  // --- Fields from the "Admin Tasks" List ---
  // Note: API access to custom fields on this list is currently blocked (ACCESS_067).
  // Standard fields (Assignee, Due Date) can still be fetched.
  ADMIN_TASKS: {
    FILE_LINKS: 'TBD', // This is the only field we cannot currently access.
  },
};
