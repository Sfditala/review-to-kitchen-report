# التشغيل: من الصفر لأول إيميل

## 1. المفاتيح

| Credential بـ n8n | بتنستخدم بـ |
|---|---|
| **OpenAI API** | Classify review · Write 3 decisions |
| **Google Sheets OAuth2** | Read reviews · Write labels to sheet |
| **Gmail OAuth2** | Send report · Email the error |

**OpenAI:** platform.openai.com ← API keys ← Create، وتأكد إنو في رصيد بالحساب (المفتاح بدون رصيد بيرجّع 429).
بـ n8n: Credentials ← Add ← **OpenAI**. الـ HTTP nodes مضبوطة على *Predefined Credential Type ← OpenAI API*، فبس اختار الـ credential.

**Google (Sheets + Gmail):** على n8n Cloud بكبسة *Sign in with Google*.
على سيرفر خاص بدك OAuth client من Google Cloud: فعّل Sheets API و Gmail API و Drive API، وانسخ الـ redirect URL من نافذة الـ credential.
إذا شاشة الموافقة ضلّت على **Testing**، الربط بينتهي بعد 7 أيام وإيميل الأحد الجاي بيفشل، فحوّلها لـ **In production**.

---

## 2. الشيت

1. Google Sheets ← شيت جديد ← **File ← Import ← Upload** ← `data/reviews.csv` ← **Replace current sheet**
2. انسخ الـ ID من الرابط (بين `/d/` و `/edit`) وحطه بـ `sheet_id` بـ **Config**

الـ workflow بيقرأ أول تاب بالـ ID (`gid=0`)، فاسم التاب ما بيفرق. والأعمدة الفاضية (`dish` … `classified_at`) لازم تضل موجودة.

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
2. المتوقع: ~40–60 ثانية (40 مراجعة، 5 بالثانية)
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
كل مراجعة ≈ 600 token دخل + 150 خرج. 40 مراجعة + طلب القرارات ≈ **أقل من 3 سنت** بـ `gpt-4.1-mini`.
[⚠️ بحاجة لرقم مقاس: شوفي `stats.tokens` بمخرجات **Aggregate patterns** بعد التشغيل]

## 7. لو بدك تعدّلي الكود
كود الـ Code nodes موجود كملفات بـ `dev/code-nodes/`. عدّلي هناك، بعدين:
```bash
node dev/build.mjs
```
```bash
node dev/run-local.mjs
```
(الأول بيبني `workflow.json` من جديد، والتاني بيختبر كل شي محلياً بدون OpenAI)
