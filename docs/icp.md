# Ideal Customer Profile: 108 Slokas Gita Learning PWA

Status: draft built from the repo alone. No customer, analytics or pricing data was available, so **every figure below is an assumption** unless marked "observed in repo". Validate with the test in section 9.

## 0. Assumptions (validate first)

| # | Assumption | How to check |
|---|---|---|
| A1 | The app is free today (no billing in the code). Revenue, if any, comes from institutions (licence, sponsorship, white-label), not individuals. | Founder confirms |
| A2 | Individual learners are the adoption engine; institutions are the paying route. | Look at who shares and refers |
| A3 | Core market is India (Tamil and English/Sanskrit content observed in repo), with diaspora in US, UK, Gulf, Singapore. | Vercel Analytics country split |
| A4 | Sales motion is community and WhatsApp led, low-touch, deal size small (assume under INR 1 lakh per year per institution). | Pilot results |
| A5 | Product differentiators (observed in repo): 108 curated verses, a 4-step listen-repeat-understand-recall loop, per-verse audio, offline PWA, streak and recall tracking, all 18 chapter audios, purports. | n/a |

## 1. Priority segments (summary)

| Rank | Segment | Firmographics | Key persona | Main trigger | Evidence |
|---|---|---|---|---|---|
| 1 | Gita-recitation programs run by spiritual organizations (ISKCON centres, Chinmaya Mission Balavihar, Art of Living, local satsangs) | 1 to 20 centres, 50 to 1,000 enrolled learners, India and diaspora | Program coordinator or "Gita class" teacher | An annual verse-recitation competition or a 108-verse challenge | Assumption. Product matches 108-verse memorisation, a common format |
| 2 | Gurukuls, Sanskrit pathshalas and value-education schools | 100 to 1,000 students, ages 8 to 18, Android-first households | Principal or Sanskrit/moral-science head | Term syllabus or exam recitation requirement; parents asking for home practice | Assumption |
| 3 | Diaspora weekend schools (Balavihar, Tamil/Hindu schools in US, UK, Singapore, Gulf) | 30 to 300 children, volunteer-run | Volunteer coordinator or parent committee | Start of the school year; recitation day | Assumption |

Individuals (adult self-learners, parents of children) are the user base, not the buyer. Do not build a paid plan for them before segment 1 is tested.

## 2. Company profile

- **Revenue/budget:** assumption: annual budget for digital learning tools under INR 50,000 to 2 lakh, often donation-funded.
- **Size:** 50 to 1,000 learners per institution; 1 to 10 teachers or volunteers; 0 to 1 staff with a tech role.
- **Verticals:** religious/spiritual education, Sanskrit education, supplementary (weekend) schools.
- **Geography:** Tier 1: Tamil Nadu, Karnataka, Maharashtra, Gujarat, Delhi NCR. Tier 2: US, UK, Singapore, UAE diaspora centres.
- **Growth stage:** established programs with a recurring annual event, not new start-ups.
- **Tech maturity:** low to medium. Uses WhatsApp groups, YouTube, Google Forms. Learners on Android phones with patchy data, which suits offline PWA and 64 kbps audio.
- **Business model:** non-profit or trust, donation or fee funded.

## 3. Decision-making unit

| Persona | Role in decision | Pain points | Success metrics | How they evaluate |
|---|---|---|---|---|
| Program coordinator / teacher (champion) | Recommends; often decides alone below small budgets | Cannot track who memorised which verse; students forget by the next class; recordings scattered across WhatsApp | % of class completing N verses; attendance at recitation day; fewer repeat reminders | Tries it with one class for 2 to 4 weeks |
| Principal / trustee (approver) | Signs off cost or sponsorship | Credibility of text and translation; child data privacy; cost | Parent feedback; no complaints about content | Checks content sources, asks who else uses it |
| Parents (influencer) | Push adoption at home | Children skip practice; parents cannot pronounce Sanskrit | Child practises daily; streaks | Install friction, one-tap audio |
| Donor/sponsor (rare) | Funds licence | Visible impact | Learners reached | Usage report |

## 4. Business characteristics

- **Budget capacity:** low; prefers free pilot, then annual flat fee or sponsorship. Assumption.
- **Buying cycle:** 2 to 8 weeks for coordinator-led pilots; 2 to 4 months if a trust meeting is needed. Assumption.
- **Technical requirements:** works offline, installs without an app store, low-bandwidth audio, Android Chrome and iOS Safari, Roman transliteration, English and Tamil display (Devanagari is stored for search but not displayed). Observed in repo.
- **Compliance:** child data privacy matters (India DPDP Act 2023 covers children's data; verify requirements before onboarding under-18 cohorts). Today progress is local-only by default, which is a selling point.
- **Content sensitivity:** institutions follow specific traditions and commentaries. Content accuracy and translation sourcing (see `docs/translation-sources.md`) affect trust.
- **Current challenges:** no way for a teacher to see class progress. This is the main gap, since the product has no teacher or class view today. Product implication: an institution tier needs a cohort or class dashboard.

## 5. Behavioural indicators (prospecting checklist)

Qualify yes/no. Four or more yes means a priority prospect.

- [ ] Runs a public Gita recitation event or competition at least once a year.
- [ ] Publishes class schedules or recitation videos on YouTube, Instagram or Facebook.
- [ ] Has a WhatsApp or Telegram group for learners (ask for the member count; 50 or more).
- [ ] Posted in the last 90 days about a 108-verse, chapter-12 or chapter-15 memorisation challenge.
- [ ] Teaches children aged 8 to 18 with a recurring weekly class.
- [ ] Teachers share audio files manually.
- [ ] Has a named coordinator reachable by phone or email.
- [ ] Located where Android is dominant and bandwidth is limited, or a diaspora centre with a school-year calendar.

## 6. Buying readiness

- **Best timing (assumption):** 4 to 8 weeks before a recitation competition; start of an academic year (June to July in India, September in the diaspora); Gita Jayanti (December); Krishna Janmashtami.
- **Urgency triggers:** a competition date; a new batch enrolling; complaints that students forget verses; a teacher leaving.
- **Typical timeline:** week 0 demo to coordinator; weeks 1 to 4 pilot with one class; week 5 review of completion data; weeks 6 to 8 trustee approval for wider rollout.
- **Approval sequence:** coordinator, then principal or trustee, then (if paid) treasurer or sponsor.

## 7. Anti-personas

| Avoid | Why |
|---|---|
| Large commercial ed-tech platforms wanting white-label for free | Disproportionate customisation and support; content licensing questions |
| Single individuals asking for custom verse sets or new languages | One-off requests, no scale, drift from the 108-verse roadmap |
| Institutions needing strict school LMS integration (grades, SSO) | Roadmap misfit; heavy integration work for small budgets |
| Groups that follow a different verse set or commentary and want it replaced | Content customisation burden; trust issues |
| Corporate wellness buyers wanting engagement analytics and SLAs | Different buyer, long cycles, wrong feature set |
| Programs with no recurring cohort or event | Low retention, one-time use |

## 8. Prioritisation and next steps

1. Run a free pilot with 3 to 5 programs from segment 1; recruit through the coordinator checklist above.
2. Build the minimum teacher view (class roster, verses completed, streaks) only if two or more pilots ask for it.
3. Decide pricing after the pilots, using willingness to pay from the trustee conversation.

## 9. Test of this ICP

Compare the next 20 prospects or pilots against the section 5 checklist. Expect pilots scoring 4 or more to reach at least 60% of learners completing one chapter in 4 weeks (target, assumption). If they don't, revisit segments 2 and 3 before spending more on outreach.

## 10. Open questions

1. Is the app staying free? What is the B2B offer and price?
2. Who are the best current users, and how did they find the app?
3. Is child data privacy a constraint for institutional rollout?
4. Is the teacher dashboard on the roadmap?
5. Real analytics: country split, retention, installs. Replace assumptions A1 to A4 with these.

## Sources

- Repo: `CLAUDE.md`, `docs/translation-sources.md`, `docs/learning-tools.md` (product features, content, offline behaviour).
- No external benchmarks or market sizes were used. DPDP Act reference in section 4 needs legal verification.
