# AI Usage Documentation

This document explains how Lockdn uses AI, the implications for academic integrity, and considerations for IT and academic policy administrators.

---

## AI Integration Overview

Lockdn integrates AI capabilities to help students study more effectively. All AI features use the student's own API key (BYOK — Bring Your Own Key).

### Supported AI Providers

| Provider | Models Used | Data Region |
|----------|-------------|-------------|
| Anthropic | Claude family (claude-sonnet, etc.) | US, EU |
| OpenAI | GPT-4, GPT-4o | US, EU |
| Google | Gemini Pro, etc. | US, EU, Global |
| Ollama | User's local models | User's machine |

---

## AI Features

### 1. Syllabus Parsing

**Purpose:** Extract assignments, due dates, and course information from uploaded syllabi.

**How it works:**
1. User uploads syllabus (PDF, Word, image)
2. Document sent to AI provider with extraction prompt
3. AI returns structured data (assignments, dates)
4. User reviews and approves before adding

**Data sent to AI:**
- Syllabus document content
- Extraction instructions

**Academic integrity risk:** Low — assists with administrative task

### 2. Note Processing

**Purpose:** Extract text from handwritten or photographed notes.

**How it works:**
1. User uploads note images
2. Images sent to AI with vision capability
3. AI extracts text, summarizes, identifies topics
4. User reviews extracted content

**Data sent to AI:**
- Note images
- Processing instructions

**Academic integrity risk:** Low — assists with organization

### 3. AI Tutor

**Purpose:** Provide educational assistance through conversational AI.

**How it works:**
1. User asks question
2. Context added (courses, assignments, notes)
3. Request sent to AI with tutor persona
4. AI responds with educational guidance

**Data sent to AI:**
- User's question
- Context: course info, upcoming deadlines, relevant notes
- Conversation history
- System prompt enforcing tutor behavior

**Academic integrity risk:** See section below

### 4. Study Guide Generation

**Purpose:** Create study materials from student notes.

**How it works:**
1. User selects notes
2. Notes sent to AI with study guide prompt
3. AI generates structured study guide
4. User reviews and saves

**Data sent to AI:**
- Note content
- Study guide generation instructions

**Academic integrity risk:** Low — transforms student's own work

### 5. Practice Exam Generation

**Purpose:** Create practice questions based on student notes.

**How it works:**
1. User selects notes and question types
2. Notes sent to AI with exam generation prompt
3. AI generates questions and answers
4. User takes practice exam

**Data sent to AI:**
- Note content
- Question generation instructions

**Academic integrity risk:** Low — generates practice content, not real exam answers

### 6. Exam Grading

**Purpose:** Provide feedback on practice exam responses.

**How it works:**
1. Student completes practice exam
2. Responses sent to AI with grading rubric
3. AI provides scores and feedback
4. Student reviews feedback

**Data sent to AI:**
- Student's practice answers
- Correct answers
- Grading instructions

**Academic integrity risk:** Low — only grades self-generated practice exams

---

## Academic Integrity Design

### The Challenge

AI tutoring creates tension between helpfulness and academic integrity. Students might use an AI tutor to get homework answers rather than learn.

### Lockdn's Approach

Lockdn's AI tutor is designed to support learning without enabling cheating:

#### 1. Persona Design

The tutor uses a "wise mentor" persona:
- Guides through questions rather than giving answers
- Asks "What do you think?" and "What have you tried?"
- Explains concepts but encourages application
- Celebrates understanding, not just correct answers

#### 2. Mode Detection

The system detects when students are seeking homework answers:

**Homework-seeking indicators:**
- Questions matching assignment descriptions
- Specific problem statements ("solve for x in...")
- Proximity to assignment due dates
- Phrasing patterns ("what's the answer to...")

**Response when detected:**
- Acknowledge the question
- Explain the teaching approach
- Redirect to learning-focused discussion
- Never shame or block the student

#### 3. Context-Aware Responses

The tutor knows the student's academic context:
- Current courses and topics
- Upcoming assignments and due dates
- Student's notes on the subject
- Previous conversations and demonstrated understanding

This allows it to:
- Guide appropriately for the student's level
- Reference their own materials
- Track progress and adjust teaching

#### 4. No Hard Blocking

Lockdn intentionally doesn't:
- Refuse to discuss certain topics
- Block questions about homework
- Shame students for seeking help

Instead, it:
- Reframes questions toward learning
- Offers Socratic guidance
- Helps students understand methodology

### Example Interactions

**Homework-seeking pattern:**
```
Student: What's the answer to problem 3.14 where you have to
         find the derivative of x^2 + 3x?

Tutor:   I can see you're working on derivatives! Instead of
         giving you this answer directly, let me help you
         understand the process.

         What rule do you think we should apply here?
         Remember, for polynomial terms, there's a pattern
         with the exponent...
```

**Learning-focused pattern:**
```
Student: I don't understand how derivatives work. Can you
         explain?

Tutor:   Derivatives measure the rate of change of a function.
         Think of it like this: if you're driving a car, the
         speedometer shows your derivative — how fast your
         position is changing.

         Would you like me to walk through a simple example?
```

---

## Data Sent to AI Providers

### What's Included

| Data Type | Included | Purpose |
|-----------|----------|---------|
| User questions | Yes | Primary input |
| Course names | Yes | Context |
| Assignment titles | Yes | Context |
| Note content | Yes | Reference material |
| Conversation history | Yes | Continuity |
| Due dates | Yes | Scheduling context |
| Grades | No | Not relevant to tutoring |
| Personal identifiers | No | Not needed |
| API keys | No (auth header only) | Never in payload |

### What's NOT Included

- Student names or identifiers
- Email addresses
- Institution names
- Other personal information

### Data Retention by Providers

Each AI provider has their own data retention policies:

| Provider | Training on Data | Retention | Link |
|----------|------------------|-----------|------|
| Anthropic | No (API) | Limited | anthropic.com/privacy |
| OpenAI | Opt-out available | 30 days | openai.com/privacy |
| Google | Varies | Varies | cloud.google.com/privacy |
| Ollama | Local | None | Local processing |

Recommend students review their chosen provider's policies.

---

## Institutional Considerations

### AI Policy Integration

Consider how Lockdn fits your institution's AI policy:

| Policy Element | Lockdn Behavior |
|----------------|-----------------|
| AI use disclosure | Transparent — clearly labeled as AI |
| Assignment assistance | Designed to guide, not give answers |
| Source citation | Students should cite AI assistance per policy |
| Prohibited uses | Tutor redirects away from direct answers |

### Guidance for Students

Recommend institutions advise students:

1. **Understand your AI policy** — Know what's allowed
2. **Use for learning, not answers** — Lockdn supports this
3. **Cite AI assistance** — If required by policy
4. **Choose your provider carefully** — Review their data practices

### Monitoring Limitations

Institutions cannot monitor:
- What questions students ask
- AI responses students receive
- How students use AI features

This is by design — data stays on student devices.

---

## Comparison to Other AI Tools

### Lockdn vs. ChatGPT/Claude Web

| Aspect | Lockdn Tutor | General AI Chat |
|--------|--------------|-----------------|
| Purpose | Educational guidance | General-purpose |
| Behavior | Guides to understanding | Directly answers |
| Context | Knows your courses | Fresh each chat |
| Academic design | Intentional integrity features | None |

### Lockdn vs. Assignment-Completion Tools

| Aspect | Lockdn | "Do my homework" tools |
|--------|--------|------------------------|
| Goal | Learning | Completion |
| Approach | Socratic | Direct |
| Integrity | Designed in | Not considered |

---

## Risk Assessment

### Academic Integrity Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Getting homework answers | Low | Socratic design, mode detection |
| Generating essays | Low | Not designed for long-form generation |
| Cheating on exams | Very Low | Practice exams only, no real exam integration |
| Misrepresenting AI work | Medium | Student education needed |

### Data Privacy Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Data breach at AI provider | Low | Student's choice of provider |
| Educational records exposed | Low | Student controls what to share |
| Institutional liability | Very Low | No institutional relationship |

### Recommendation

Lockdn presents lower academic integrity risk than general-purpose AI tools due to its intentional design for educational guidance rather than answer provision.

---

## FAQ

### "Can students use this to cheat?"

Students determined to cheat have many options. Lockdn is specifically designed to support learning rather than enable cheating. Its Socratic approach makes it less effective for getting answers than alternatives.

### "Should we block Lockdn?"

Lockdn requires no special network access beyond HTTPS. Blocking would require blocking AI provider APIs, which would affect many legitimate uses.

### "Do we need a data sharing agreement?"

No. The institution isn't sharing data with Lockdn. Students independently choose to use Lockdn and their own AI provider.

### "How do we know it actually guides instead of answers?"

The code is open-source. You can review the system prompts and mode detection logic in the repository.

### "What if students ignore the guidance?"

Students can have multiple conversations and rephrase questions. The AI consistently maintains its guidance approach. Students seeking direct answers will find general AI tools more effective (and Lockdn doesn't prevent access to those).
