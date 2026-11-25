# التشغيل: من الصفر لأول إيميل

## 1. المفاتيح

| Credential بـ n8n | بتنستخدم بـ |
|---|---|
| **Header Auth** (مفتاح الموديل) | Classify review · Write 3 decisions |
| **Google Sheets OAuth2** | Read reviews · Write labels to sheet |
| **Gmail OAuth2** | Send report · Email the error |

**مفتاح الموديل (مجاني):** aistudio.google.com/apikey ← **Create API key** (مفتاح Gemini، بدون بطاقة).
بـ n8n: Credentials ← Add ← **Header Auth**:
- Name: `Authorization`
- Value: `Bearer ` وبعدها المفتاح (فيه مسافة بعد Bearer)

اختاري هاد الـ credential بـ **Classify review (LLM)** و **Write 3 decisions (LLM)**.

> بدك OpenAI بدل Gemini؟ بـ **Config** غيّري `llm_url` لـ `https://api.openai.com/v1/chat/completions` و `model` لـ `gpt-4.1-mini`، وحطي مفتاح OpenAI بنفس الـ Header Auth. وبالـ node **Classify** ارفعي الـ Batch Size لـ 5 والـ Interval لـ 1000.

**Google (Sheets + Gmail):** على n8n Cloud بكبسة *Sign in with Google*.
على سيرفر خاص بدك OAuth client من Google Cloud: فعّل Sheets API و Gmail API و Drive API، وانسخ الـ redirect URL من نافذة الـ credential.
إذا شاشة الموافقة ضلّت على **Testing**، الربط بينتهي بعد 7 أيام وإيميل الأحد الجاي بيفشل، فحوّلها لـ **In production**.

---

## 2. الشيت

1. Google Sheets ← شيت جديد ← **File ← Import ← Upload** ← `data/reviews.csv` ← **Replace current sheet**
2. انسخ الـ ID من الرابط (بين `/d/` و `/edit`) وحطه بـ `sheet_id` بـ **Config**

3. اكتب اسم التاب (تحت بالشيت) بـ `sheet_tab`. لما Google بيحوّل CSV لشيت ممكن يسمّيه `Untitled` أو `Sheet1`. والأعمدة الفاضية (`dish` … `classified_at`) لازم تضل موجودة.

> لازم يكون حساب Google المربوط بـ credential الـ Sheets بيقدر يفتح الشيت (مالك أو Editor).

---

## 3. الاستيراد بـ n8n

1. **Import from File** ← `shared/error-alert.workflow.json` ← node **Email the error** ← إيميلك + Gmail credential ← Save
2. **Import from File** ← `workflow.json`
3. **Config** ← `sheet_id` و `report_to`
4. اختار الـ credential بالـ 5 nodes اللي عليهم ⚠️
5. **Settings** ← **Error workflow** ← `D0 · error-alert` ← Save

## 4. أول تشغيل

1. كبسي **Execute workflow** (من `Run manually (test)`)
2. المتوقع: حوالي دقيقة ونص (كل المراجعات بتروح للموديل بطلب واحد). أول تشغيل حقيقي أخد 100 ثانية.
3. تأكدي:
   - [ ] **Prepare week** طلّع **40** item (مش 42)
   - [ ] الشيت تعبّى بالأعمدة الجديدة
   - [ ] وصل إيميل، وأول قرار عن **الشاورما · الجمعة مسائي**
4. سجّلي الشاشة لحظة وصول الإيميل على الجوال 🎥

## 5. للإنتاج (بعد الديمو)
- `Config ← reference_date: ''` (فاضي = التاريخ الحقيقي)
- **Publish / Activate** ← بيشتغل كل أحد 9:00 بتوقيت عمّان
- المطعم الحقيقي: عدّلي `menu` و `restaurant_name`، وإذا ما في وقت زيارة، حطي تاريخ المراجعة بـ `review_date` (الشفت رح يطلع "غداء" دايماً، وهاد حد موثّق)

## 6. التكلفة (تقديري)
**على Gemini المجاني: صفر.** 41 طلب بالأسبوع أقل بكتير من الحد اليومي للمستوى المجاني.
على OpenAI: كل مراجعة ≈ 600 token دخل + 150 خرج، يعني 40 مراجعة + طلب القرارات ≈ **أقل من 3 سنت** بـ `gpt-4.1-mini`.
[⚠️ بحاجة لرقم مقاس: شوفي `stats.tokens` بمخرجات **Aggregate patterns** بعد التشغيل]

## 7. لو بدك تعدّلي الكود
كود الـ Code nodes موجود كملفات بـ `dev/code-nodes/`. عدّلي هناك، بعدين:
```bash
node dev/build.mjs
```
```bash
node dev/run-local.mjs
```
(الأول بيبني `workflow.json` من جديد، والتاني بيختبر كل شي محلياً بدون مفاتيح)
