# التشغيل: من الصفر لأول إيميل

## 1. المفاتيح

| # | Credential بـ n8n | الحالة | بتنستخدم بـ |
|---|---|---|---|
| 1 | **Google Sheets OAuth2** (`Google Sheets account`) | ✅ موجود، ومربوط تلقائياً بالملف | Read reviews · Write labels to sheet |
| 2 | **OpenAI API** | ❌ لازم ينعمل | Classify review · Write 3 decisions |
| 3 | **Gmail OAuth2** | ❌ لازم ينعمل | Send report · Email the error |

**OpenAI:** platform.openai.com ← API keys ← Create. وتأكدي إنو في رصيد بالحساب (Billing)، لأنو المفتاح بدون رصيد بيرجّع 429.
بـ n8n: Credentials ← Add ← **OpenAI** ← الصقي المفتاح. (الـ HTTP nodes مضبوطة على *Predefined Credential Type ← OpenAI API*، فبس اختاري الـ credential.)

**Gmail:** على n8n Cloud: Credentials ← Add ← **Gmail OAuth2** ← Sign in with Google.
على سيرفر خاص بدك OAuth client من Google Cloud (Gmail API + Sheets API + Drive API مفعّلين، والـ redirect URL بتنسخيه من نافذة الـ credential). وإذا ضلّت شاشة الموافقة على **Testing**، الربط بينتهي بعد 7 أيام، فحوّليها لـ **In production**.

---

## 2. الشيت (جاهز)

[D1 · reviews · review-to-kitchen-report](https://docs.google.com/spreadsheets/d/1JyvYcGDssD6m7Fe5A9oXMXmVIAdsyUePnDZUQ2IEoe8/edit): 42 مراجعة، والـ ID محطوط بـ **Config**.

> ⚠️ الشيت انعمل بحساب Google الجامعي. إذا credential الـ **Google Sheets** بـ n8n مربوط بحساب تاني، اعمليله **Share ← Editor** لهداك الحساب، وإلا القراءة بتفشل بـ "not found".

---

## 3. الاستيراد بـ n8n

1. **Workflows ← Create folder** ← `7 Days 7 Projects`
2. جوّا المجلد: **⋯ ← Import from File** ← `shared/error-alert.workflow.json`
   - node **Email the error** ← حطي إيميلك مكان `YOUR_EMAIL@example.com` ← Gmail credential ← Save
3. **Import from File** ← `workflow.json`
4. **Config** ← `report_to` ← إيميلك (وبس، الباقي جاهز)
5. اختاري الـ credential بالـ 3 nodes اللي عليهم ⚠️ (2 OpenAI + 1 Gmail)
6. **Settings** (⋯ فوق) ← **Error workflow** ← `D0 · error-alert` ← Save

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
