# LinkedIn post: Day 1

Images, in this order: the email in Gmail (`assets/gmail-real.png`) · the complaint heatmap · the workflow canvas.
Before posting: replace `[X]/25` with the score from `score.md`.

---

## العربي

5 زباين اشتكوا إنو الشاورما باردة. نفس الليلة، نفس الشفت.
وصاحب المطعم قرأ كل شكوى لحالها، ورد على كل وحدة "نعتذر عن الإزعاج".

اليوم 1 من 7 · مطاعم 🍽️

😩 المشكلة:
المراجعات السيئة بتنقرأ وحدة وحدة، فما حدا بينتبه إنها عن نفس الصحن بنفس الشفت، والشكوى ما بتوصل للمطبخ.

⚙️ اللي بنيته:
workflow على n8n بيشتغل كل أحد الساعة 9. بيقرأ مراجعات الأسبوع من Google Sheet (فصحى ولهجة وإنجليزي)، بيصنّف كل وحدة حسب الصحن والمشكلة والحدّة، بيعدّ الأنماط، وبيبعت للمدير والشيف إيميل فيه 3 قرارات. لكل قرار مسؤول، وإجراء بينفحص بالشفت الجاي. ومعهم مسودة رد لكل زبون زعلان.

📊 أول تشغيل حقيقي (40 مراجعة تجريبية):
• فيها مشكلة ولا لأ: 40 من 40
• الصحن الصح: 39 من 40
• كل الأنماط المزروعة انكشفت، وأول قرار كان عن الشاورما بليلة الجمعة

🧠 قرار تقني:
الذكاء الاصطناعي بيصنّف، والكود بيعدّ. الموديل اللي بيكتب القرارات ما بيشوف ولا مراجعة، بياخد الأرقام جاهزة من الكود، فما بيقدر يحكي "7 شكاوى" إذا كانوا 5. والصحن بيختاره من قائمة المنيو بس، وإلا "شاورما" و"ساندويش شاورما دجاج" بيصيروا صحنين.

🔧 شو ما زبط من أول مرة:
أول تشغيل علّق 10 دقايق. اسم الموديل كان موقوف للحسابات الجديدة، وكنت باعتة طلب لكل مراجعة (41 طلب). هلأ كل المراجعات بتروح بطلب واحد، والتشغيل بياخد دقيقة.

🚧 الحدود:
بيحتاج وقت الزيارة عشان يعرف الشفت، ومراجعات Google لحالها ما فيها هالمعلومة. والردود ما بتنشر لحالها، المدير بيراجعها.

📝 تجربة التوثيق اليوم: README أول
كتبت التوثيق قبل ما أبني أي إشي، وبعدين قارنت. 7 خطوات بالخطة صاروا 13 node. الهيكل صمد، بس فاتني سؤال واحد: كل معلومة من وين بتيجي؟
علامتها: [X]/25

الكود والتوثيق والقصة كاملة:
github.com/Sfditala/review-to-kitchen-report

بدك متله لمطعمك؟ 👇
#7أيام_7مشاريع #أتمتة #n8n #AI #مطاعم

---

## English

Five customers said the shawarma was cold. Same night, same shift.
The owner read each review on its own and replied "sorry to hear that" five times.

Day 1 of 7 · Restaurants 🍽️

😩 The problem:
Bad reviews get read one at a time. Nobody notices they're about the same dish on the same shift, so the complaint never reaches the kitchen.

⚙️ What I built:
An n8n workflow that runs every Sunday at 9. It reads the week's reviews from a Google Sheet (Arabic, dialect and English), tags each one by dish, problem and severity, counts the patterns, and emails the manager and the chef three decisions. Each one has an owner and an action they can check on the next shift. Every unhappy customer also gets a draft reply.

📊 First real run, 40 demo reviews:
• Problem or not: 40 out of 40
• Right dish: 39 out of 40
• Every planted pattern found. Decision #1 was the Friday-night shawarma.

🧠 Technical decision:
The AI tags, the code counts. The model that writes the decisions never sees a review, only the numbers, so it can't say "7 complaints" when there were 5. The dish comes from a fixed menu list, otherwise "shawarma" and "chicken shawarma sandwich" become two dishes.

🔧 What broke:
The first run hung for 10 minutes. The model name had been retired for new keys, and I was sending one request per review, 41 in all. Now the whole week goes in one request and a run takes about a minute.

🚧 Limits:
It needs the visit time to know the shift, and Google reviews alone don't have it. Replies stay drafts until a person posts them.

📝 Today's documentation experiment: README first
I wrote the docs before building anything, then compared. 7 planned steps became 13 nodes. The structure held, but I missed one question: where does each field come from?
Score: [X]/25

Code, docs and the whole story:
github.com/Sfditala/review-to-kitchen-report

Want this for your restaurant? 👇
#7Days7Projects #Automation #n8n #AI #Restaurants
