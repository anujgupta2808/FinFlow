import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Brain, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, CreditCard, FileText, Flag, Gauge, HandCoins, Heart, Home, Leaf, Menu, MessageCircle, Plus, RefreshCw, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Target, TrendingDown, TrendingUp, Upload, Wallet, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './style.css';
import './experience.css';

const ACTIVE_EMAIL_KEY = 'aetherwealth-active-email';
const accountKey = email => `aetherwealth-account:${encodeURIComponent(email)}`;
const loadAccount = email => {
 try { return JSON.parse(localStorage.getItem(accountKey(email)) || 'null'); }
 catch { return null; }
};
const randomSalt = () => {
 const salt = crypto.getRandomValues(new Uint8Array(16));
 return btoa(String.fromCharCode(...salt));
};
async function passwordHash(password,salt){
 if(!crypto.subtle)throw new Error('Password sign-in requires a secure browser context (HTTPS or localhost).');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(atob(salt),char=>char.charCodeAt(0)),iterations:150000,hash:'SHA-256'},key,256);
 return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
async function passwordMatches(password,salt,expected){
 const actual=Uint8Array.from(atob(await passwordHash(password,salt)),char=>char.charCodeAt(0));
 const target=Uint8Array.from(atob(expected),char=>char.charCodeAt(0));
 if(actual.length!==target.length)return false;
 let mismatch=0;
 actual.forEach((value,index)=>{mismatch|=value^target[index]});
 return mismatch===0;
}
const emptyData = () => ({
 transactions: [],
 rules: [],
 profile: { income: 0, fixed: 0, cash: 0, runwayTarget: 0, diningBudget: 0, shoppingBudget: 0 },
 goals: []
});
const profileKey = email => `aetherwealth-state:${email}`;
const notificationKey = email => `aetherwealth-notifications:${email}`;
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const loadProfile = email => {
 const saved = localStorage.getItem(profileKey(email));
 if (!saved) return emptyData();
 try { return { ...emptyData(), ...JSON.parse(saved) }; }
 catch { return emptyData(); }
};
const money = (n, compact=false) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:compact?0:2,notation:compact?'compact':'standard'}).format(n||0);
const monthLabel = new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});
const nav = [{name:'Living Pulse',icon:Home},{name:'Ingestion studio',icon:Upload},{name:'Subscription radar',icon:Activity},{name:'Daily track',icon:CalendarDays},{name:'Living money model',icon:Gauge},{name:'Monthly review',icon:FileText},{name:'AI money coach',icon:MessageCircle},{name:'Profile settings',icon:Settings2},{name:'Help & contact',icon:CircleHelp}];

function App(){
 const [account,setAccount]=useState(()=>{const email=sessionStorage.getItem(ACTIVE_EMAIL_KEY);return email?loadAccount(email):null;});
 const signIn=async({email,password})=>{
  const normalized=email.trim().toLowerCase(),user=loadAccount(normalized);
  if(!user)return 'No local account exists for this email. Create an account to continue.';
  if(!await passwordMatches(password,user.salt,user.passwordHash))return 'The email or password is incorrect.';
  sessionStorage.setItem(ACTIVE_EMAIL_KEY,normalized);
  setAccount(user);
  return '';
 };
 const register=async({name,occupation,email,password})=>{
  const normalized=email.trim().toLowerCase();
  if(loadAccount(normalized))return 'An account for this email already exists on this device.';
  const salt=randomSalt();
  const user={name:name.trim(),occupation:occupation.trim(),email:normalized,salt,passwordHash:await passwordHash(password,salt),createdAt:new Date().toISOString()};
  localStorage.setItem(accountKey(normalized),JSON.stringify(user));
  sessionStorage.setItem(ACTIVE_EMAIL_KEY,normalized);
  setAccount(user);
  return '';
 };
 const updateAccount=next=>{
  localStorage.setItem(accountKey(next.email),JSON.stringify(next));
  setAccount(next);
 };
 const changePassword=async(currentPassword,newPassword)=>{
  if(!await passwordMatches(currentPassword,account.salt,account.passwordHash))return 'Current password is incorrect.';
  const salt=randomSalt();
  updateAccount({...account,salt,passwordHash:await passwordHash(newPassword,salt)});
  return '';
 };
 const signOut=()=>{sessionStorage.removeItem(ACTIVE_EMAIL_KEY);setAccount(null);};
 return account?<Dashboard key={account.email} user={account} onUserUpdate={updateAccount} onPasswordChange={changePassword} onSignOut={signOut}/>:<LoginScreen onSignIn={signIn} onRegister={register}/>;
}

const defaultGreeting = name => ({
 role: 'assistant',
 text: `Hey ${name ? name.trim().split(/\s+/)[0] : 'there'}! 👋 Great to see you. How are you doing today?

I'm your FinFlow companion. We can chat just like normal friends—how your day is going, what's on your mind, or anything about your spending, budget, and goals. What's up?`
});

function generateHumanReply(rawMsg, ctx) {
 const { user, totals, data, runway, monthlySubs, driftDining, driftShopping } = ctx;
 const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'friend';
 const msg = (rawMsg || '').trim().toLowerCase();
 const cleaned = msg.replace(/[?!.,'""'']/g, ' ').replace(/\s+/g, ' ').trim();

 const hour = new Date().getHours();
 const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 22 ? 'Good evening' : 'Hey there';

 // 1. STOCK / CRYPTO GUARDRAIL
 const forbidden = /\b(recommend|pick|buy|sell|which)\b.{0,30}\b(stocks?|crypto|bitcoin|ethereum|etf|mutual funds?|securities)\b|\b(buy|sell)\b.{0,20}\b(nvda|stocks?|crypto|bitcoin|ethereum|etf|mutual funds?)\b/i.test(rawMsg);
 if (forbidden) {
  return `I can't tell you which specific stock, fund, or crypto token to buy or sell—no responsible friend or AI should pick individual speculative bets for you! 😄

What I *can* do is help you think through timeless principles:
1. **Build an emergency cushion first:** Make sure you have accessible cash for rainy days so you never have to panic-sell.
2. **Diversify broadly:** Low-cost index funds let you own a slice of hundreds of top businesses without the headache of picking single winners.
3. **Play the long game:** Time in the market beats trying to time market swings every single time.

What kind of time horizon or goals are you planning for?`;
 }

 // 2. SPECIFIC TIME GREETINGS
 if (/\bgood morning\b/i.test(cleaned)) {
  return `Good morning, ${firstName}! ☀️ Hope your day is off to a bright and positive start. How are you doing today?`;
 }
 if (/\bgood afternoon\b/i.test(cleaned)) {
  return `Good afternoon, ${firstName}! 🌤️ Hope the day has been treating you well so far. How's everything going?`;
 }
 if (/\bgood evening\b/i.test(cleaned)) {
  return `Good evening, ${firstName}! 🌙 Hope you had a fulfilling day today. How are things on your end tonight?`;
 }
 if (/\bgood night\b/i.test(cleaned)) {
  return `Good night, ${firstName}! ✨ Get some great, restful sleep. We can always pick things back up whenever you're ready!`;
 }

 // 3. GREETINGS & HOW ARE YOU
 const isGreeting = /^(hi|hello|hey|heyy+|howdy|yo|sup|hiya|hola|namaste|greetings)\b/i.test(cleaned) ||
  /^(hi|hello|hey|yo) +there\b/i.test(cleaned);
 const isHowAreYou = /\b(how are you|how('s|s) it going|how are things|how('s|s) your day|how have you been|how do you do|what('s|s) up|wassup|how is everything|hows life)\b/i.test(cleaned);

 if (isGreeting && isHowAreYou) {
  return `${timeGreeting}, ${firstName}! 👋 I'm doing really well, thank you for asking!

I'm feeling energized and ready to chat. We can look at your numbers, brainstorm savings ideas, or just talk about how your week is going. How's everything on your end today?`;
 }

 if (isHowAreYou) {
  return `I'm doing great, thank you for asking! 😊 Ready to help you look at numbers, chat through your week, or just bounce ideas around.

How has your day been treating you so far? Anything exciting going on, or just keeping it chill?`;
 }

 if (isGreeting) {
  return `${timeGreeting}, ${firstName}! 👋 Great to see you.

How are you doing today? We can chat about your daily habits, check how your budget is pacing, or just have a relaxed conversation. What's on your mind?`;
 }

 // 4. IDENTITY / WHO ARE YOU / WHAT CAN YOU DO
 if (/\b(who are you|what is your name|what('s|s) your name|tell me about yourself|introduce yourself|what can you do|how can you help|what are your capabilities)\b/i.test(cleaned)) {
  return `I'm FinFlow! Think of me as your personal financial sidekick and everyday conversational partner. 🌿

Here's how we can hang out:
• **Casual Conversation:** Talk about your day, celebrate your wins, or vent about money stress—I'm here to listen like a normal human friend.
• **Spending & Cash Flow:** Check where your money is flowing this month without judgment.
• **Savings & Runway:** Calculate how long your safety cushion will last and find painless ways to stash extra cash.
• **Goal Planning:** Keep an eye on the things you're saving up for and make sure you're on pace.

What would you like to explore today?`;
 }

 // 5. GRATITUDE & COURTESY
 if (/\b(thank you|thanks|thx|tysm|appreciate it|thank u|grateful|you('re|re) the best|you('re|re) great)\b/i.test(cleaned)) {
  return `You're so welcome, ${firstName}! 😊 Happy to be here with you.

Whenever you want to chat, brainstorm, or check your goals, I'll be right here. Have anything else on your mind?`;
 }

 // 6. FAREWELLS / GOODBYE
 if (/\b(bye|goodbye|cya|see you|see ya|catch you later|talk to you later|have a good one|have a nice day|have a good day)\b/i.test(cleaned)) {
  return `Take care and have a wonderful day ahead, ${firstName}! 👋 Pop back in whenever you feel like having a chat or checking in on your goals. Talk soon!`;
 }

 // 7. SHORT AFFIRMATIONS / REACTIONS (ok, cool, nice, ok cool, sounds good)
 if (/^(ok|okay|cool|nice|awesome|great|got it|sounds good|perfect|sweet|neat|alright|fine|yep|yeah|sure)( +(ok|okay|cool|nice|awesome|great|got it|sounds good|perfect|sweet|neat|alright|fine|yep|yeah|sure|thanks|then))*$/i.test(cleaned)) {
  return `Sounds like a plan! 😊 Let me know where we should go from here, or feel free to throw any question my way.`;
 }

 // 8. LAUGHTER & HUMOR / JOKES
 if (/\b(haha|hahaha|lol|lmao|rofl|that('s|s) funny|you('re|re) funny)\b/i.test(cleaned)) {
  return `Haha, glad I could bring a smile to your face! 😄 Life is way too short to make money talk boring or stressful. What else is on your mind?`;
 }

 if (/\b(tell me a joke|joke|make me laugh|say something funny)\b/i.test(cleaned)) {
  const jokes = [
   `Why did the dollar bill go to therapy? Because it had too much emotional baggage from being stretched too thin! 😄 What do you think?`,
   `Why don't coins ever feel lonely? Because they always travel in change! 🪙😂 Got any good jokes yourself?`,
   `Why is money called dough? Because we all knead it! 🍞 Hope that made you smile. How's the rest of your day going?`
  ];
  return jokes[Math.floor(Math.random() * jokes.length)];
 }

 // 9. ARE YOU HUMAN / REAL / BOT?
 if (/\b(are you (a )?(human|real|person|bot|robot|ai))\b/i.test(cleaned)) {
  return `I'm an AI companion, but I believe talking about money—or anything in life—should feel human, friendly, and honest rather than robotic and cold!

I'm here to chat with you just like a thoughtful friend. How has your day been so far?`;
 }

 // 10. EMOTIONAL EMPATHY (STRESS, BROKE, WORRY, OVERWHELMED)
 if (/\b(stressed|stressful|anxious|anxiety|worried|worry|overwhelmed|depressed|sad|tired|exhausted|burnout|hate bills|money is hard|struggling|broke|scared)\b/i.test(cleaned)) {
  return `I hear you, and honestly, money stress is so real and completely valid. Almost everyone feels that pressure at some point.

Take a deep breath—you don't have to fix everything today, and you definitely don't have to do it alone. Just being here and taking an honest look is already a big step in the right direction.

If you'd like, we can take things one tiny step at a time, or we can take a break from numbers and just chat. How are you holding up right now?`;
 }

 // 11. CELEBRATIONS & WINS
 if (/\b(got a job|promotion|raise|bonus|got paid|saved money|bought a house|vacation|happy|yay|congrats|milestone|good news|celebrate)\b/i.test(cleaned)) {
  return `That is huge! 🎉 Big congratulations, ${firstName}! It takes real work and dedication to reach milestones like that.

Definitely take a moment to celebrate—you earned it! What's the plan to celebrate this win?`;
 }

 // 12. AFFORDABILITY & DINING CHECK
 if (/\b(afford|can i|should i)\b.*\b(eat|dining|dinner|lunch|food|order|restaurant)\b/i.test(cleaned)) {
  const dining = totals.by.Dining || 0;
  return `Looking at dining so far this month, you've spent around ${money(dining)}. ${totals.net >= 0 ? `You currently have a monthly surplus of ${money(totals.net)}, so as long as your essentials are covered, treating yourself to a nice dinner definitely fits!` : `Things are running a bit tight this month (net balance: ${money(totals.net)}), so maybe pick a cozy, budget-friendly meal.`}

Life is meant to be enjoyed, so never feel guilty about good food—just keep it intentional so it doesn't crowd out your other goals. Enjoy your meal! 🍲`;
 }

 // 13. CASUAL LIFE CHAT (Food, Coffee, Weather, Weekend)
 if (/\b(coffee|pizza|food|eat|dinner|lunch|breakfast|tea|beer|drink|burger)\b/i.test(cleaned)) {
  return `Food is honestly one of life's greatest pleasures! 🍲 Life is way too short to cut out things you love—the secret is just planning for them so you can enjoy every bite guilt-free. What are you having or craving right now?`;
 }

 if (/\b(weather|rain|sunny|cold|hot|outside)\b/i.test(cleaned)) {
  return `Weather definitely sets the vibe for the whole day! ☀️ If it's nice outside, definitely take a quick stroll—fresh air clears the head better than anything. How is it looking where you are?`;
 }

 if (/\b(weekend|friday|saturday|sunday|holiday|vacation|trip)\b/i.test(cleaned)) {
  return `Weekends and time off are essential for recharging! 🌴 Any fun plans lined up, or are you keeping it chill and restful?`;
 }

 // 14. FINANCIAL INQUIRIES
 if (/\b(how am i doing|how('s|s) my spending|how is my spending|spending pacing|overview|summary|my situation|check my numbers)\b/i.test(cleaned)) {
  if (!data.transactions.length && !data.profile.income && !data.profile.cash) {
   return `Right now we haven't imported any transactions or profile details yet!

You can head over to **Ingestion Studio** to upload a bank statement, CSV, or paste an SMS alert, or adjust your numbers in the **Living Money Model**. Once you do, I can give you a personalized breakdown.

In the meantime, feel free to ask me general questions about saving hacks, emergency funds, or budgeting!`;
  }
  const largest = Object.entries(totals.by).sort((a,b)=>b[1]-a[1])[0];
  return `Here’s the honest scoop on where things stand right now:

• **Income & Outflow:** You've logged ${money(totals.income)} coming in, and ${money(totals.expenses)} in outflow.
• **Net Balance:** ${totals.net >= 0 ? `You're ahead by +${money(totals.net)} 🎉 That's a great monthly surplus!` : `You're currently running a bit tight at ${money(totals.net)}. We can look at flexible spending to balance it out.`}
• **Emergency Reserves:** ${data.profile.cash > 0 ? `You have ${money(data.profile.cash)} in liquid reserves (~${runway.toFixed(1)} months of runway).` : `You haven't set an emergency reserve figure yet in your profile.`}
${largest ? `• **Top Expense Category:** **${largest[0]}** at ${money(largest[1])}.` : ''}
${monthlySubs.length ? `• **Subscriptions:** ${monthlySubs.length} recurring merchants totaling ~${money(monthlySubs.reduce((s, x) => s + x.cost, 0))}/mo.` : ''}

How does that feel compared to what you were expecting?`;
 }

 if (/\b(runway|emergency fund|emergency reserve|safety net|cushion)\b/i.test(cleaned)) {
  return `Think of your financial runway just like an airplane runway—it's how many months you could cruise along comfortably if your income stopped tomorrow.

Right now, your model shows **${runway > 0 ? `${runway.toFixed(1)} months of runway` : 'no runway calculated yet'}** (${money(data.profile.cash)} in cash reserves vs ${money(data.profile.fixed)} in monthly essentials).

A healthy target is usually 3 to 6 months of essential living costs. It gives you unmatched peace of mind and freedom to make choices without panic. How close do you feel to your ideal safety cushion?`;
 }

 if (/\b(dining|eating out|restaurants?|takeout|delivery|swiggy|zomato|doordash)\b/i.test(cleaned)) {
  const dining = totals.by.Dining || 0;
  return `Dining out and ordering good food is one of the best ways to unwind! 🍲

Looking at your ledger, you've spent around **${money(dining)}** on Dining so far.
If your core essentials are covered, never feel guilty about enjoying a great meal. A handy habit is just setting a comfortable weekly dining cap so you can feast with total peace of mind. Are you thinking about treating yourself to something nice?`;
 }

 if (/\b(goal|goals|target|milestones?)\b/i.test(cleaned)) {
  if (!data.goals.length) {
   return `You don't have any active goals set up yet!

Setting a clear goal with a name and a target date (like a vacation fund, a new gadget, or a buffer fund) makes saving feel exciting rather than restrictive. You can tap **Add goal** in the **Living Money Model** anytime! What's something you'd love to save for?`;
  }
  const goalList = data.goals.map(g => `• **${g.name}:** ${money(g.saved)} saved of ${money(g.target)} (${Math.round((g.saved / g.target) * 100)}%)`).join('\n');
  return `Here’s how your active goals are progressing:

${goalList}

Which of these goals are you most excited to cross the finish line on?`;
 }

 if (/\b(subscription|subscriptions|recurring|netflix|spotify|radar)\b/i.test(cleaned)) {
  if (!monthlySubs.length) {
   return `I haven't spotted recurring subscription patterns in your ledger yet! If you import a couple of months of transactions in the **Ingestion Studio**, I'll automatically highlight recurring charges.`;
  }
  const subList = monthlySubs.map(s => `• **${s.merchant}:** ${money(s.cost)}/mo`).join('\n');
  const totalSubs = monthlySubs.reduce((s, x) => s + x.cost, 0);
  return `Here are the recurring subscriptions detected from your transactions:

${subList}
**Total estimated:** ${money(totalSubs)}/month (${money(totalSubs * 12)}/year).

A simple tip: do a quick audit and see if there's one subscription you haven't opened in the past 30 days. Canceling just one is often an instant ₹500–₹1,500/month back in your pocket!`;
 }

 if (/\b(save|saving|budget|cut costs|reduce expenses|money tip|save more|how to save)\b/i.test(cleaned)) {
  const largest = Object.entries(totals.by).sort((a,b)=>b[1]-a[1])[0];
  return `Here are 3 practical, human-friendly ways to save without feeling miserable:

1. **Pay yourself first:** When money comes in, automatically tuck away 5% to 10% into savings before you even start spending.
2. **Cap one flexible category:** ${largest ? `Your largest expense category right now is **${largest[0]}** (${money(largest[1])}). Instead of cutting everything, just set a gentle weekly boundary here.` : 'Pick just one area (like dining or shopping) and set a gentle weekly cap.'}
3. **Audit subscriptions:** Cancel any app or service you haven't used this month.

Small, steady adjustments always beat extreme restrictions! Which of those sounds easiest to try this week?`;
 }

 if (/\b(invest|investing|investment|portfolio|diversif|risk tolerance|stocks?|etf|index fund)\b/i.test(cleaned)) {
  return `Investing is basically putting your money to work for your future self! A sound, stress-free framework to keep in mind:

1. **Emergency safety first:** Make sure you have accessible cash for rainy days (ideally 3 to 6 months of expenses) before putting money into the market.
2. **Diversify & keep fees low:** Low-cost, broad-market index funds allow you to own a slice of hundreds of top businesses without the headache of picking single winners.
3. **Time in the market:** Staying invested long-term beats trying to jump in and out of the market.

Are you thinking about short-term goals (under 3 years) or long-term growth (5+ years)?`;
 }

 // 15. DEFAULT CONVERSATIONAL FALLBACK
 return `I hear you, ${firstName}! As your FinFlow companion, I'm here both to chat like a normal person and to help you navigate your finances without the stress.

${data.transactions.length > 0 ? `By the way, your profile is currently tracking ${data.transactions.length} transactions with a net balance of ${money(totals.net)}.` : `Whenever you're ready, you can also add your income, expenses, or goals to see them come alive.`}

What would you like to chat about—everyday budgeting hacks, your goals, or something else entirely?`;
}
function Dashboard({user,onUserUpdate,onPasswordChange,onSignOut}){
 const {email}=user;
 const [data,setData]=useState(()=>loadProfile(email)),[view,setView]=useState('Living Pulse'),[toast,setToast]=useState(''),[mobile,setMobile]=useState(false),[query,setQuery]=useState(''),[notificationsOpen,setNotificationsOpen]=useState(false),[seenNotifications,setSeenNotifications]=useState(()=>{try{const saved=JSON.parse(localStorage.getItem(notificationKey(email))||'[]');return Array.isArray(saved)?saved:[]}catch{return[]}});
 const [scenario,setScenario]=useState({dining:0,shopping:0,rent:0,income:0}),[chat,setChat]=useState(()=>[defaultGreeting(user.name)]),[isTyping,setIsTyping]=useState(false),[draft,setDraft]=useState(''),[apiKey,setApiKey]=useState('');
 const chatEndRef=useRef(null);
 useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:'smooth'});},[chat,isTyping]);
 const update=(next)=>{setData(next);localStorage.setItem(profileKey(email),JSON.stringify(next));};
 const notify=(text)=>{setToast(text);setTimeout(()=>setToast(''),4200);};
 const totals=useMemo(()=>{let t=data.transactions;let expenses=t.filter(x=>x.amount<0),income=t.filter(x=>x.amount>0).reduce((s,x)=>s+x.amount,0);let by={};expenses.forEach(x=>by[x.category]=(by[x.category]||0)-x.amount);return {income,expenses:expenses.reduce((s,x)=>s-x.amount,0),by,net:income-expenses.reduce((s,x)=>s-x.amount,0)}},[data]);
 const dining=totals.by.Dining||0, shopping=totals.by.Shopping||0;
 const monthlySubs=useMemo(()=>{const groups={};data.transactions.filter(x=>x.category==='Subscriptions'&&x.amount<0).forEach(x=>{if(!groups[x.merchant])groups[x.merchant]=[];groups[x.merchant].push(x)});return Object.entries(groups).filter(([,items])=>items.length>1).map(([merchant,items])=>({merchant,items,cost:Math.max(...items.map(x=>-x.amount)),last:items.sort((a,b)=>b.date.localeCompare(a.date))[0].date}));},[data.transactions]);
 const dailyRecords=useMemo(()=>{
  const grouped={};
  data.transactions.forEach(transaction=>{
   const day=grouped[transaction.date]||(grouped[transaction.date]={date:transaction.date,transactions:[],income:0,expenses:0});
   day.transactions.push(transaction);
   if(transaction.amount>0)day.income+=transaction.amount;
   else day.expenses+=Math.abs(transaction.amount);
  });
  return Object.values(grouped).map(day=>({...day,net:day.income-day.expenses})).sort((a,b)=>b.date.localeCompare(a.date));
 },[data.transactions]);
 const notificationItems=useMemo(()=>{
  if(dailyRecords.length===0)return [{id:'empty-ledger',title:'Start your daily track',message:'No transactions are saved yet. Import your own activity to build a day-by-day record.',view:'Ingestion studio'}];
  const latest=dailyRecords[0];
  return [
   {id:`daily-${latest.date}-${latest.transactions.length}`,title:'Latest day recorded',message:`${latest.transactions.length} transaction${latest.transactions.length===1?'':'s'} on ${new Date(`${latest.date}T12:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}. View the daily record.`,view:'Daily track'},
   ...monthlySubs.map(subscription=>({id:`subscription-${subscription.merchant}-${subscription.items.length}-${subscription.last}`,title:'Recurring pattern detected',message:`${subscription.merchant} appears ${subscription.items.length} times in your imported transactions (${money(subscription.cost)}/mo estimated).`,view:'Subscription radar'}))
  ];
 },[dailyRecords,monthlySubs]);
 const unreadNotifications=notificationItems.filter(item=>!seenNotifications.includes(item.id)).length;
 const runway=data.profile.fixed>0?data.profile.cash/data.profile.fixed:0;
 const driftDining=Math.max(0,dining-data.profile.diningBudget*16/30), driftShopping=Math.max(0,shopping-data.profile.shoppingBudget*16/30);
 const scenarioDelta=dining*scenario.dining/100+shopping*scenario.shopping/100-scenario.rent+scenario.income;
 const filtered=data.transactions.filter(x=>x.merchant.toLowerCase().includes(query.toLowerCase())||x.category.toLowerCase().includes(query.toLowerCase()));
 function markNotificationsRead(ids=notificationItems.map(item=>item.id)){
  const next=[...new Set([...seenNotifications,...ids])];
  localStorage.setItem(notificationKey(email),JSON.stringify(next));
  setSeenNotifications(next);
 }
 function openNotification(item){
  markNotificationsRead([item.id]);
  setView(item.view);
  setNotificationsOpen(false);
  setMobile(false);
 }
 function categorize(tx,category){let next={...data,transactions:data.transactions.map(t=>t.id===tx.id?{...t,category}:t)};let keyword=tx.merchant.toUpperCase().replace(/[^A-Z0-9 ]/g,'').trim().split(/\s+/).slice(0,2).join(' ');let rules=[...data.rules.filter(r=>r.keyword!==keyword),{keyword,category}];next.rules=rules;next.transactions=next.transactions.map(t=>t.merchant.toUpperCase().includes(keyword)?{...t,category}:t);update(next);let count=next.transactions.filter(t=>t.merchant.toUpperCase().includes(keyword)).length;notify(`Rule learned: “${keyword}” → ${category}. Applied to ${count} matching transaction${count===1?'':'s'}.`);}
 function parseSms(text){let lines=text.split(/\n/).filter(Boolean),out=[];for(let line of lines){let amountMatch=line.match(/(?:INR|RS\.?|USD|₹|\$)\s?([\d,]+(?:\.\d{1,2})?)/i)||line.match(/(?:₹|\$)([\d,]+(?:\.\d{1,2})?)/);if(!amountMatch)continue;let amount=Number(amountMatch[1].replace(/,/g,''));let dateMatch=line.match(/\b(\d{1,2}[-/][A-Za-z0-9-]+|\d{4}-\d{2}-\d{2})\b/);let merchant=(line.match(/(?:UPI\/|at |to )([^/;]+?)(?:\/|;| via |\s+Ref|$)/i)||[])[1]?.trim()||line.slice(0,48);let isCredit=/credited|received|salary|refund/i.test(line);let tx={id:Date.now()+Math.random(),merchant,amount:isCredit?amount:-amount,category:categoryFor(merchant,data.rules),date:dateMatch?normalizeDate(dateMatch[1]):dateKey(new Date())};out.push(tx)}return out;}
 function categoryFor(merchant,rules){let u=merchant.toUpperCase();let learned=rules.find(r=>u.includes(r.keyword));if(learned)return learned.category;let m=[['Grocery|Trader Joe|Whole Foods','Groceries'],['Sweetgreen|DoorDash|Restaurant|Coffee|Dining','Dining'],['Uber|Lyft|Transit','Transport'],['Adobe|Netflix|Spotify|Equinox','Subscriptions'],['Rent|Housing','Housing'],['Con Edison|Utilities','Utilities'],['Amazon|Shop','Shopping'],['Salary|Freelance|Income','Income']].find(([rx])=>new RegExp(rx,'i').test(merchant));return m?.[1]||'Other';}
 function normalizeDate(s){if(!s)return dateKey(new Date());let d=new Date(s);if(Number.isNaN(+d))return dateKey(new Date());return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:dateKey(d)}
 async function fileUpload(file){if(!file)return;try{let text;if(file.name.toLowerCase().endsWith('.pdf')){const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';let pdf=await pdfjs.getDocument(await file.arrayBuffer()).promise;text='';for(let i=1;i<=pdf.numPages;i++){let page=await pdf.getPage(i);let content=await page.getTextContent();text+=content.items.map(x=>x.str).join(' ')+'\n'}}else text=await file.text();let parsed=parseCsv(text);if(!parsed.length&&file.name.toLowerCase().endsWith('.pdf'))parsed=parsePdfText(text);if(parsed.length){update({...data,transactions:[...parsed,...data.transactions]});notify(`Imported ${parsed.length} transactions from ${file.name}.`)}else{let tx=parseSms(text);if(tx.length){update({...data,transactions:[...tx,...data.transactions]});notify(`Imported ${tx.length} transactions from ${file.name}.`)}else notify('No transactions found. Check the statement format and try again.')}}catch(e){notify('Could not read that file. Try a CSV or text-based PDF statement.')}}
 function parsePdfText(raw){let results=[];for(const line of raw.split(/\r?\n|(?=\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b)/)){let m=line.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?(?:₹|INR|Rs\.?|\$)?\s?[\d,]+\.\d{2})(?:\s|$)/i);if(!m)continue;let amount=Number(m[3].replace(/[₹$,]|\bINR\b|\bRS\.?\b|\s/gi,''));if(!amount)continue;let merchant=m[2].replace(/\s{2,}/g,' ').trim();results.push({id:Date.now()+Math.random(),merchant,amount:/(credit|deposit|payment received)/i.test(line)?Math.abs(amount):-Math.abs(amount),date:normalizeDate(m[1]),category:categoryFor(merchant,data.rules)})}return results}
 function parseCsv(raw){let rows=raw.replace(/^\uFEFF/,'').split(/\r?\n/).filter(r=>r.trim()).map(line=>line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c=>c.trim().replace(/^"|"$/g,'')));if(rows.length<2)return[];let h=rows[0].map(x=>x.toLowerCase());let idx=(...tests)=>h.findIndex(x=>tests.some(t=>x.includes(t)));let di=idx('date','posted'),mi=idx('description','merchant','narration','details','payee'),ai=idx('amount','transaction amount'),db=idx('debit','withdrawal'),cr=idx('credit','deposit');if(mi<0)return[];return rows.slice(1).flatMap((r,i)=>{const number=(v)=>Number(String(v||'').replace(/[$,()]/g,'').trim())||0;let amt=0;if(ai>=0)amt=number(r[ai]);else if(db>=0||cr>=0){let debit=number(r[db]),credit=number(r[cr]);amt=credit?Math.abs(credit):debit?-Math.abs(debit):0}if(!amt)return[];let m=r[mi]||'Bank transaction';return[{id:Date.now()+i+Math.random(),merchant:m,amount:amt,date:normalizeDate(r[di]||'')}].map(t=>({...t,category:categoryFor(m,data.rules)}))})}
 function profileField(key,value){update({...data,profile:{...data.profile,[key]:Number(value)}})}
 function saveScenario(){let next={...data,profile:{...data.profile,income:data.profile.income+scenario.income,fixed:data.profile.fixed+scenario.rent},goals:data.goals.map(g=>({...g,saved:g.saved+(scenarioDelta>0?Math.round(scenarioDelta*3):0)}))};update(next);setScenario({dining:0,shopping:0,rent:0,income:0});notify('Scenario committed to your living plan.')}
 function reset(){if(window.confirm('Clear all financial data saved for this profile on this device?')){update(emptyData());setScenario({dining:0,shopping:0,rent:0,income:0});notify('Local profile data cleared.')}}
 function saveHelpRequest(request){
  const key=`aetherwealth-support:${email}`;
  const existing=JSON.parse(localStorage.getItem(key)||'[]');
  localStorage.setItem(key,JSON.stringify([...existing,{...request,createdAt:new Date().toISOString()}]));
  notify('Help request saved on this device. It was not sent to a support team.');
 }
 async function sendChat(directMsg){
  const msg = (typeof directMsg === 'string' ? directMsg : draft).trim();
  if(!msg || isTyping) return;
  const messages = [...chat, { role: 'user', text: msg }];
  setChat(messages);
  setDraft('');
  setIsTyping(true);

  const snapshot = {
    userName: user.name,
    occupation: user.occupation,
    profile: data.profile,
    runwayMonths: Number(runway.toFixed(1)),
    recentTransactions: data.transactions.slice(0, 10),
    subscriptions: monthlySubs.map(({ merchant, cost, last }) => ({ merchant, cost, last })),
    spendingDrift: { dining: driftDining, shopping: driftShopping },
    goals: data.goals,
    totals: { income: totals.income, expenses: totals.expenses, net: totals.net, byCategory: totals.by }
  };

  const context = {
    user,
    data,
    totals,
    runway,
    monthlySubs,
    driftDining,
    driftShopping
  };

  if(apiKey){
   try{
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
      systemInstruction: {
       parts: [{
        text: `You are FinFlow, a warm, genuine, thoughtful, and down-to-earth personal finance companion and AI friend.
You converse like a real, friendly human person—empathetic, relatable, encouraging, and natural.
Key conversational behaviors:
1. GREETINGS & SOCIAL CHAT: Greet back warmly and naturally (e.g. "Hey ${user.name ? user.name.split(' ')[0] : 'there'}! 👋 How's your day going?"). Converse normally: respond to casual check-ins, ask how they are doing, show personality and light humor.
2. EMPATHY & CELEBRATION: If the user feels stressed, broke, or overwhelmed, validate their feelings with compassion. If they share good news or a win, celebrate enthusiastically.
3. FINANCIAL INSIGHTS: Explain budgeting, saving, cash flow, and runway in simple, practical human terms without robotic lectures or corporate jargon.
4. GROUNDED: Weave in relevant facts from their profile snapshot when answering financial questions, but do NOT dump raw stats unprompted if the user is just saying hi or chatting casually.
5. NO INDIVIDUAL STOCK/CRYPTO PICKS: If asked for specific stock/crypto picks, gently decline individual stock/token gambling, while warmly explaining broad diversification, emergency buffers, and long-term horizons.
User Name: ${user.name || 'Friend'}
User Profile Snapshot: ${JSON.stringify(snapshot)}`
       }]
      },
      contents: messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
       role: m.role === 'assistant' ? 'model' : 'user',
       parts: [{ text: m.text }]
      })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 750 }
     })
    });
    const body = await response.json();
    if(!response.ok) throw new Error(body.error?.message || 'Gemini request failed');
    const reply = body.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || 'I couldn’t form a response just now. Let’s try again!';
    setChat(prev => [...prev, { role: 'assistant', text: reply }]);
   }catch(e){
    const reply = generateHumanReply(msg, context);
    setChat(prev => [...prev, { role: 'assistant', text: reply }]);
   }finally{
    setIsTyping(false);
   }
  } else {
   setTimeout(() => {
    const reply = generateHumanReply(msg, context);
    setChat(prev => [...prev, { role: 'assistant', text: reply }]);
    setIsTyping(false);
   }, 400);
  }
 }
 return <div className="app-shell" data-empty={data.transactions.length===0} data-has-subs={monthlySubs.length>0} data-view={view}><aside className={`sidebar ${mobile?'mobile-open':''}`}><div className="brand"><img src="./logo.png" alt="FinFlow" className="brand-logo-img"/><button className="icon-btn mobile-close" onClick={()=>setMobile(false)}><X size={18}/></button></div><div className="workspace-label">YOUR MONEY, IN MOTION</div><nav>{nav.map(({name,icon:Icon},i)=><button key={name} onClick={()=>{setView(name);setMobile(false)}} className={`nav-item ${view===name?'active':''}`}><Icon size={17}/><span>{name}</span>{i===2&&monthlySubs.length>0&&<span className="nav-count">{monthlySubs.length}</span>}</button>)}</nav><div className="side-bottom"><div className="side-card"><div className="side-card-icon"><Sparkles size={16}/></div><p>Your money has a plan.<br/><b>Let’s keep it growing.</b></p><button onClick={()=>setView('Living money model')}>Review your goals <ArrowRight size={14}/></button></div><div className="side-user"><div className="avatar">{(user.name||user.email||'U')[0].toUpperCase()}</div><div><b>{user.name||user.email||'User'}</b><small>{user.occupation||'Personal workspace'}</small></div><button className="icon-btn" title="Clear local profile data" onClick={reset}><RefreshCw size={15}/></button></div><div className="reset-note" onClick={reset}>Clear local profile data</div></div></aside>
 <main className="main"><header className="topbar"><button className="icon-btn menu-btn" onClick={()=>setMobile(!mobile)}><Menu size={19}/></button><div className="breadcrumb">FinFlow <ChevronRight size={14}/> <span>{view}</span></div><div className="top-actions"><span className="date-label">{monthLabel}</span><button className="icon-btn notification" title="Notifications"><Bell size={18}/><i/></button><div className="avatar avatar-small">{(user.name||user.email||'U')[0].toUpperCase()}</div></div></header>
 <div className="page-content">{view==='Living Pulse'?<><div className="page-heading"><div><div className="eyebrow">{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase()} <span className="live"><i/> LIVE MODEL</span></div><h1>Your money, <em>in balance.</em></h1><p className="subtitle">A clear view of where you are—and what’s possible from here.</p></div><button className="button button-outline" onClick={()=>setView('Ingestion studio')}><Plus size={16}/> Add transactions</button></div>
 <section className="hero-grid"><div className="hero-card"><div className="card-topline"><span className="eyebrow">MONTHLY SAVINGS PACE</span>{totals.net > 0 ? <span className="pill pill-green"><TrendingUp size={13}/> On track</span> : <span className="pill pill-neutral"><Clock3 size={13}/> No surplus yet</span>}</div><div className="hero-number">{money(totals.net,true)}<span className="hero-cents">.00</span></div><div className="hero-caption">Estimated monthly surplus <span className="dot-sep">·</span> {money(Math.max(0,totals.net))} income less spending</div><div className="hero-chart">{false&&<ResponsiveContainer width="100%" height="100%"><AreaChart data={[{v:24},{v:31},{v:27},{v:40},{v:37},{v:53},{v:48},{v:64},{v:60},{v:77},{v:72},{v:91}]}><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#188363" stopOpacity=".22"/><stop offset="100%" stopColor="#188363" stopOpacity="0"/></linearGradient></defs><Area dataKey="v" type="monotone" stroke="#16745b" strokeWidth={2.5} fill="url(#fill)"/></AreaChart></ResponsiveContainer>}</div><div className="hero-foot"><span><i className="legend-dot"/> Savings trajectory</span><span>{data.transactions.length > 0 ? 'Last 12 weeks' : 'No data recorded'}</span></div></div><div className="metric-stack"><div className="metric-card"><div className="metric-label"><span>LIQUID RESERVES</span><Wallet size={16}/></div><div className="metric-value">{money(data.profile.cash,true)}</div><div className="metric-sub"><span className="text-green">{runway.toFixed(1)} months</span> runway {data.profile.runwayTarget > 0 ? <span className="muted">· {data.profile.runwayTarget} mo target</span> : null}</div><div className="progress-track"><span style={{width:`${Math.min(100,runway/data.profile.runwayTarget*100)}%`}}/></div></div><div className="metric-card"><div className="metric-label"><span>GOAL MOMENTUM</span><Target size={16}/></div><div className="metric-value">{Math.round(data.goals.reduce((s,g)=>s+g.saved/g.target,0)/Math.max(1,data.goals.length)*100)}<small>%</small></div><div className="metric-sub">Across {data.goals.length} active goals </div><div className="goal-mini-bars">{data.goals.map(g=><i key={g.name} style={{width:`${g.saved/g.target*100}%`,background:g.color}}/>)}</div></div><div className="metric-card compact-metric"><div className="metric-label"><span>SPENDING THIS MONTH</span><CreditCard size={16}/></div><div className="metric-value">{money(totals.expenses,true)}</div><div className="metric-sub">of {money(totals.income,true)} recorded income {totals.income > 0 ? <span className="text-green">· {Math.round(totals.net/totals.income*100)}% saved</span> : null}</div></div></div></section>
 <div className="section-title-row"><div><h2>Your living pulse</h2><p>A clear snapshot of activity you’ve added.</p></div><button className="text-button" onClick={()=>setView('Monthly review')}>Monthly review <ArrowRight size={14}/></button></div><section className="pulse-grid"><div className="panel spend-panel"><div className="panel-header"><div><h3>Spending by category</h3><p>{monthLabel} · from your recorded transactions</p></div></div><div className="spend-chart"><div className="spend-legend">{[['Housing','#16745b'],['Dining','#a7c6b5'],['Groceries','#d4ad72'],['Shopping','#8290ae'],['Subscriptions','#d9b0a7'],['Other','#e9e7e1']].map(([name,color])=><div key={name}><i style={{background:color}}/><span>{name}</span><b>{money(totals.by[name]||0,true)}</b></div>)}</div></div></div></section>
 <section className="panel transactions-panel"><div className="panel-header"><div><h3>Recent activity</h3><p>Your transactions, made understandable</p></div><div className="transaction-actions"><div className="search-box"><Search size={14}/><input placeholder="Search activity" value={query} onChange={e=>setQuery(e.target.value)}/></div><button className="text-button" onClick={()=>setView('Ingestion studio')}>All transactions <ArrowRight size={14}/></button></div></div><TransactionTable rows={filtered.slice(0,6)} categorize={categorize}/></section></>:null}
 {view==='Ingestion studio'&&<><PageIntro eyebrow="SMART INGESTION" title={<>Make sense of <em>the messy bits.</em></>} desc="Bring in transactions from a bank alert, statement, or CSV. We’ll help sort the rest."/><ProfileIngestion onFile={fileUpload} smsParse={parseSms} add={(tx)=>update({...data,transactions:[...tx,...data.transactions]})} notify={notify}/><section className="panel transactions-panel"><div className="panel-header"><div><h3>Transaction ledger</h3><p>Click a category to teach your model</p></div><div className="search-box"><Search size={14}/><input placeholder="Search transactions" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><TransactionTable rows={filtered} categorize={categorize}/></section><RuleRegistry rules={data.rules} remove={r=>update({...data,rules:data.rules.filter(x=>x.keyword!==r.keyword)})}/></>}
 {view==='Subscription radar'&&<><PageIntro eyebrow="RECURRING PAYMENTS" title={<>The small charges that <em>add up.</em></>} desc="Recurring merchants are estimated from repeated subscription transactions in your ledger."/><section className="summary-strip"><Summary label="ESTIMATED MONTHLY" value={money(monthlySubs.reduce((s,x)=>s+x.cost,0))} icon={RefreshCw}/><Summary label="ESTIMATED ANNUAL" value={money(monthlySubs.reduce((s,x)=>s+x.cost,0)*12)} icon={TrendingUp}/><Summary label="RECURRING MERCHANTS" value={`${monthlySubs.length}`} icon={Activity}/></section><section className="panel ledger-panel"><div className="panel-header"><div><h3>Detected recurring merchants</h3><p>Only merchants with repeated subscription transactions appear here.</p></div><span className="pill pill-neutral">{monthlySubs.length} detected</span></div>{monthlySubs.length>0&&<><div className="sub-table-head"><span>MERCHANT</span><span>CADENCE</span><span>MONTHLY EST.</span><span>ANNUAL EST.</span><span>LAST ACTIVITY</span><span>STATUS</span></div>{monthlySubs.map(s=><div className="sub-row" key={s.merchant}><div className="merchant-cell"><div className="merchant-mark">{s.merchant.slice(0,1)}</div><b>{s.merchant}</b></div><span>Observed</span><b className="mono">{money(s.cost)}</b><span className="mono">{money(s.cost*12)}</span><span>{new Date(s.last+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span><span className="status status-ok">Estimated</span></div>)}</>}</section></>}
 {view==='Living money model'&&<><PageIntro eyebrow="YOUR LIVING MONEY MODEL" title={<>A plan that moves <em>with you.</em></>} desc="Your profile, goals, and scenarios—connected to one living picture of your finances."/><section className="model-grid"><div className="panel profile-panel"><div className="panel-header"><div><h3>Your financial profile</h3><p>Changes update your plan as you go</p></div><Settings2 size={17}/></div><div className="field-grid"><MoneyField label="Monthly net income" value={data.profile.income} onChange={v=>profileField('income',v)}/><MoneyField label="Fixed essential costs" value={data.profile.fixed} onChange={v=>profileField('fixed',v)}/><MoneyField label="Liquid emergency fund" value={data.profile.cash} onChange={v=>profileField('cash',v)}/><MoneyField label="Runway target · months" value={data.profile.runwayTarget} onChange={v=>profileField('runwayTarget',v)} step="1"/></div><div className="runway-box"><div className="runway-emblem"><Wallet size={19}/></div><div><span>YOUR EMERGENCY RUNWAY</span><b>{runway.toFixed(1)} <small>months</small></b></div>{data.profile.runwayTarget > 0 ? <div className="runway-target">of {data.profile.runwayTarget}.0 mo target</div> : null}</div><div className="registry-title"><b>Learned rules registry</b><span>{data.rules.length} active</span></div><RuleRegistry rules={data.rules} remove={r=>update({...data,rules:data.rules.filter(x=>x.keyword!==r.keyword)})}/></div><div className="goals-panel"><div className="panel-header"><div><h3>Your goals</h3><p>Progress with a date attached</p></div><button className="button button-outline button-small" onClick={()=>{const goalName=prompt('Enter goal name (e.g. Emergency Fund):');if(!goalName||!goalName.trim())return;const targetVal=prompt('Enter target amount (₹):');if(!targetVal||Number(targetVal)<=0)return;const d=new Date();const targetDate=`${d.getFullYear()+1}-12-01`;update({...data,goals:[...data.goals,{name:goalName.trim(),target:Number(targetVal),saved:0,date:targetDate,color:'#16745b'}]});}}><Plus size={14}/> Add goal</button></div>{data.goals.map((g,i)=>{let months=Math.max(1,(new Date(g.date)-new Date())/(1000*60*60*24*30.44));let need=Math.max(0,(g.target-g.saved)/months);let available=Math.max(0,(data.profile.income-data.profile.fixed)*.35);let onTrack=need<=available;return <div className="goal-card" key={g.name}><div className="goal-title-line"><span className="goal-icon" style={{background:g.color+'18',color:g.color}}><Flag size={16}/></span><b>{g.name}</b><span className={`goal-status ${onTrack?'goal-on':'goal-late'}`}>{onTrack?'On track':'Needs a nudge'}</span><button className="icon-btn" onClick={()=>{let target=prompt('Update goal target amount',g.target);if(target&&Number(target)>0)update({...data,goals:data.goals.map(x=>x===g?{...x,target:Number(target)}:x)})}} title="Edit target"><ChevronDown size={15}/></button></div><div className="goal-amounts"><b>{money(g.saved)}</b><span>of {money(g.target)}</span><span className="goal-date">Target {new Date(g.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})}</span></div><div className="progress-track goal-progress"><span style={{width:`${Math.min(100,g.saved/g.target*100)}%`,background:g.color}}/></div><div className="goal-meta"><span>{money(need)}/mo needed</span><span>{Math.round(g.saved/g.target*100)}% complete</span></div></div>})}</div></section><WhatIf scenario={scenario} setScenario={setScenario} delta={scenarioDelta} runway={runway} goals={data.goals} commit={saveScenario} drift={driftDining}/></>}
 {view==='Monthly review'&&<><div className="report-head"><PageIntro eyebrow={`YOUR MONTHLY REVIEW · ${monthLabel.toUpperCase()}`} title={<>A month of <em>your activity.</em></>} desc="A summary built only from transactions and goals in this local profile."/><button className="button button-dark no-print" onClick={()=>window.print()}><FileText size={15}/> Print / save as PDF</button></div><section className="summary-strip"><Summary label="RECORDED SAVINGS RATE" value={`${Math.round(totals.net/Math.max(1,totals.income)*100)}%`} icon={TrendingUp}/><Summary label="RECORDED NET" value={money(totals.net)} icon={HandCoins}/><Summary label="ACTIVE GOALS" value={`${data.goals.length}`} icon={Target}/></section><section className="report-grid"><div className="panel report-panel"><h3>Income & outflow</h3><p>{monthLabel} · from your ledger</p><div className="breakdown-row"><span>Recorded income</span><b>{money(totals.income)}</b><i style={{width:'100%',background:'#16745b'}}/></div><div className="breakdown-row"><span>Fixed essentials</span><b>{money(data.profile.fixed)}</b><i style={{width:`${Math.min(100,data.profile.fixed/Math.max(1,totals.income)*100)}%`,background:'#8290ae'}}/></div>{Object.entries(totals.by).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([category,amount])=><div className="breakdown-row" key={category}><span>{category}</span><b>{money(amount)}</b><i style={{width:`${Math.min(100,amount/Math.max(1,totals.income)*100)}%`,background:'#d4ad72'}}/></div>)}</div><div className="panel report-panel"><h3>Your month in a paragraph</h3><p>Based on information saved in this profile</p><div className="narrative"><Sparkles size={17}/><p>This profile contains <b>{data.transactions.length} transactions</b>, with <b>{money(totals.income)}</b> recorded as income and <b>{money(totals.expenses)}</b> recorded as outflow. The resulting recorded net is <b>{money(totals.net)}</b>. {data.profile.fixed>0?<>Based on the essential cost entered in your model, the current reserve covers about <b>{runway.toFixed(1)} months</b>.</>:'Add essential costs and reserves in your financial model to estimate runway.'} There are <b>{monthlySubs.length} recurring merchants</b> estimated from repeated subscription transactions.</p></div></div></section>{data.goals.length>0&&<section className="panel report-goals"><h3>Your goals</h3><div className="report-goal-list">{data.goals.map(goal=><div key={goal.name}><span>{goal.name}</span><span>{Math.round(goal.saved/goal.target*100)}%</span><div className="progress-track"><i style={{width:`${goal.saved/goal.target*100}%`,background:goal.color}}/></div><b>{money(goal.saved)} <small>of {money(goal.target)}</small></b></div>)}</div></section>}</>}
 {view==='AI money coach'&&<><PageIntro eyebrow="AI FINANCIAL COACH" title={<>Good questions make <em>good plans.</em></>} desc="A friendly, human companion to chat about life, daily spending, and your money goals."/><div className="coach-layout"><div className="panel coach-card"><div className="coach-top"><div className="coach-avatar"><Sparkles size={19}/></div><div><b>Your FinFlow coach</b><span>Conversational companion & financial guide</span></div><button className="icon-btn" title="Reset conversation" onClick={()=>setChat([defaultGreeting(user.name)])}><RotateCcw size={14}/></button><span className="guardrail"><ShieldCheck size={13}/> Guardrails active</span></div><div className="guardrail-note">Friendly conversation & money education · No stock/crypto picks</div><div className="chat-thread">{chat.map((m,i)=><div className={`chat-message ${m.role}`} key={i}><div className="chat-bubble">{m.text}</div></div>)}{isTyping&&<div className="chat-message assistant"><div className="chat-bubble typing-bubble"><span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/></div></div>}<div ref={chatEndRef}/></div><div className="suggestions">{['👋 Hey, how are you?','💬 How is my spending pacing?','🍕 Can I afford dining out tonight?','💡 What are 3 easy ways to save?','😂 Tell me a funny money joke','🎯 How are my goals doing?'].map(s=><button key={s} onClick={()=>sendChat(s)}>{s}<ArrowRight size={13}/></button>)}</div><div className="chat-compose"><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()} placeholder="Say hello, ask how your money's doing, or talk about anything…"/><button onClick={()=>sendChat()} disabled={isTyping||!draft.trim()} aria-label="Send message"><ArrowRight size={17}/></button></div></div><div className="coach-context"><div className="panel"><span className="eyebrow">LIVE CONTEXT</span><h3>Your model, at a glance</h3><div className="context-row"><span>Monthly income</span><b>{data.profile.income>0?money(data.profile.income):'Not set'}</b></div><div className="context-row"><span>Liquid reserves</span><b>{data.profile.cash>0?money(data.profile.cash):'Not set'}</b></div><div className="context-row"><span>Runway</span><b>{data.profile.fixed>0?`${runway.toFixed(1)} months`:'Not available'}</b></div><div className="context-row"><span>Active goals</span><b>{data.goals.length||'None yet'}</b></div><div className="context-row"><span>Recurring payments</span><b>{monthlySubs.length?`${money(monthlySubs.reduce((s,x)=>s+x.cost,0))}/mo`:'None detected'}</b></div></div><div className="privacy-note"><ShieldCheck size={16}/><span><b>Your information stays yours.</b><br/>Only the model snapshot shown here is used to ground answers. For Gemini responses, add an API key below.</span></div><label className="key-field">Gemini API key <input type="password" placeholder="Optional · stored in this session only" value={apiKey} onChange={e=>setApiKey(e.target.value)}/></label></div></div></>}
  {view==='Profile settings'&&<ProfileSettings user={user} onSave={(name,occupation)=>onUserUpdate({...user,name,occupation})} onPasswordChange={onPasswordChange} onPrivacy={()=>setView('Privacy policy')} onTerms={()=>setView('Terms & conditions')} onClearData={reset} transactionCount={data.transactions.length} goalCount={data.goals.length}/>}
 {view==='Help & contact'&&<ContactPage user={user} onSubmit={saveHelpRequest}/>}
 {view==='Privacy policy'&&<LegalPage type="Privacy policy" onBack={()=>setView('Profile settings')}/>}
 {view==='Terms & conditions'&&<LegalPage type="Terms & conditions" onBack={()=>setView('Profile settings')}/>}
 {view==='Daily track'&&<DailyTrack records={dailyRecords} onImport={()=>setView('Ingestion studio')}/>}
 <NotificationCenter items={notificationItems} unreadCount={unreadNotifications} open={notificationsOpen} setOpen={setNotificationsOpen} onMarkRead={()=>markNotificationsRead()} onOpen={openNotification} seen={seenNotifications}/>
 </div></main><button className="account-switch" onClick={onSignOut} title={`Local profile: ${email}`}>Sign out · {user.name || email}</button>{toast&&<div className="toast"><Check size={17}/>{toast}<button onClick={()=>setToast('')}><X size={14}/></button></div>}{mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}</div>
}

function LoginScreen({onSignIn,onRegister}){
 const [mode,setMode]=useState('login'),[name,setName]=useState(''),[occupation,setOccupation]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[accepted,setAccepted]=useState(false),[policiesReviewed,setPoliciesReviewed]=useState(false),[autoPolicyReview,setAutoPolicyReview]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[legal,setLegal]=useState('');
 const submit=async event=>{
  event.preventDefault();
  setError('');
  if(mode==='register'&&password!==confirmPassword){setError('The passwords do not match.');return;}
  if(mode==='register'&&!policiesReviewed){setAutoPolicyReview(true);setLegal('Terms & conditions');return;}
  if(mode==='register'&&!accepted){setError('Review and accept the local account terms to continue.');return;}
  setBusy(true);
  try{
   const message=mode==='login'?await onSignIn({email,password}):await onRegister({name,occupation,email,password});
   if(message)setError(message);
  }catch(exception){
   setError(exception.message||'Could not complete local sign-in.');
  }finally{
   setBusy(false);
  }
 };
 const changeMode=next=>{setMode(next);setError('');setAccepted(false);setPoliciesReviewed(false);setAutoPolicyReview(false);setLegal('');};
 const closeLegal=()=>{
  if(autoPolicyReview&&legal==='Terms & conditions'){setLegal('Privacy policy');return;}
  if(autoPolicyReview&&legal==='Privacy policy'){setLegal('');setAutoPolicyReview(false);setPoliciesReviewed(true);return;}
  setLegal('');
 };
 return <main className="login-screen">
  <section className="login-art"><div className="login-orbit orbit-one"/><div className="login-orbit orbit-two"/><div className="login-art-content"><span className="login-art-mark"><img src="./favicon.png" alt="FinFlow" style={{width:38,height:38,borderRadius:10,display:'block'}}/></span><p>Money is personal.<br/><em>Make your next move clear.</em></p><div className="login-art-note"><Sparkles size={15}/> Your profile stays on this device.</div><div className="login-glass-stat"><span>BUILT AROUND YOUR LIFE</span><b>Clarity before complexity.</b><i>Track what matters. Plan what’s next.</i></div></div><div className="login-art-footer">FINFLOW <span>·</span> YOUR MONEY, YOUR PICTURE</div></section>
  <section className="login-panel"><div className="login-brand"><img src="./logo.png" alt="FinFlow" className="login-brand-img"/></div><div className="login-form-wrap">
   <div className="auth-tabs"><button type="button" className={mode==='login'?'selected':''} onClick={()=>changeMode('login')}>Sign in</button><button type="button" className={mode==='register'?'selected':''} onClick={()=>changeMode('register')}>Create account</button></div>
   <span className="eyebrow">{mode==='login'?'WELCOME BACK':'START YOUR LOCAL PROFILE'}</span><h1>{mode==='login'?<>Pick up where <em>you left off.</em></>:<>A fresh start, <em>on your terms.</em></>}</h1><p className="login-subtitle">{mode==='login'?'Sign in to the profile saved for this email on this device.':'Create a separate local profile for your finances.'}</p>
   <form onSubmit={submit}>
    {mode==='register'&&<><label htmlFor="register-name">Full name</label><input id="register-name" autoComplete="name" value={name} onChange={event=>setName(event.target.value)} required/><label htmlFor="register-occupation">Occupation</label><input id="register-occupation" autoComplete="organization-title" value={occupation} onChange={event=>setOccupation(event.target.value)} required/></>}
    <label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event=>setEmail(event.target.value)} required/>
    <label htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='register'?8:undefined} placeholder={mode==='register'?'At least 8 characters':''} value={password} onChange={event=>setPassword(event.target.value)} required/>
    {mode==='register'&&<><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} required/>
     {!policiesReviewed?<p className="policy-review-hint">After you enter these details, continue to review the terms and privacy policy.</p>:<div className="terms-accept"><label><input type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)} required/> I agree to the local account terms and privacy policy.</label><div><button type="button" onClick={()=>setLegal('Terms & conditions')}>Terms & conditions</button><button type="button" onClick={()=>setLegal('Privacy policy')}>Privacy policy</button></div></div>}</>}
    {error&&<div className="auth-error" role="alert">{error}</div>}
    <button className="button button-dark login-submit" type="submit" disabled={busy||(mode==='register'&&policiesReviewed&&!accepted)}>{busy?'Please wait…':mode==='login'?'Sign in locally':policiesReviewed?'Create my account':'Review terms & privacy'} <ArrowRight size={16}/></button>
   </form>
   <div className="local-login-note"><ShieldCheck size={16}/><span><b>Device-local accounts — not server authentication.</b><br/>Passwords are hashed in this browser; your profile and financial data remain in local storage and are not encrypted. Anyone with access to this browser or device may access them. Use a unique password.</span></div>
   <div className="login-foot">By continuing, you accept our <button type="button" onClick={()=>setLegal('Terms & conditions')}>Terms</button> and <button type="button" onClick={()=>setLegal('Privacy policy')}>Privacy policy</button>.</div>
  </div></section>
  {legal&&<LegalModal type={legal} actionLabel={autoPolicyReview&&legal==='Terms & conditions'?'Continue to privacy policy':autoPolicyReview&&legal==='Privacy policy'?'Continue to registration':'Close'} onClose={closeLegal}/>}
 </main>;
}

function LegalModal({type,onClose,actionLabel='Close'}){
 return <div className="legal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title"><button className="legal-close" onClick={onClose} aria-label="Close"><X size={18}/></button><LegalContent type={type} titleId="legal-modal-title"/><button className="button button-dark" onClick={onClose}>{actionLabel}</button></section></div>;
}

function LegalContent({type,titleId}){
 if(type==='Privacy policy')return <div className="legal-content"><span className="eyebrow">YOUR DATA</span><h2 id={titleId}>Privacy policy</h2><p className="legal-updated">Local prototype · Updated November 2026</p><p>This prototype stores account records and financial profile data in this browser’s local storage. Email is used only to select a separate profile on this device. Passwords are stored as salted, derived hashes; they are not sent to a server. Local storage is not encrypted and is accessible to people or software with access to this browser or device.</p><h3>AI coach</h3><p>If you configure a Gemini API key and use the AI coach, your prompt and the profile snapshot included with it are sent to Google’s Gemini API. The key is held only in the current page session. Do not enter sensitive information you do not want processed by that provider.</p><h3>Help form</h3><p>Help requests in this prototype are saved locally and are not delivered to a support team. No analytics, account server, or cloud sync is connected.</p><p>This is product information for a prototype, not a legal compliance statement.</p></div>;
 return <div className="legal-content"><span className="eyebrow">USING FINFLOW</span><h2 id={titleId}>Terms & conditions</h2><p className="legal-updated">Local prototype · Updated November 2026</p><p>This prototype is provided for personal organization and educational use. It stores account and financial profile information in the current browser. There is no server-side identity verification, encrypted account vault, or cloud backup; keep independent records and use a unique password.</p><h3>Financial information</h3><p>Calculations depend on the transactions and values you enter and may be incomplete or inaccurate. The coach can explain budgeting, saving, risk, diversification, and general investing concepts, but it does not provide individualized investment, tax, or legal advice, recommend specific securities, or guarantee results.</p><h3>Third-party AI</h3><p>If you add a Gemini API key, prompts and the relevant profile snapshot may be sent to Google’s API. You are responsible for reviewing the provider’s terms and privacy practices before enabling it.</p><h3>Prototype status</h3><p>The local contact form does not send messages. This prototype is provided without a service-level or availability guarantee.</p></div>;
}

function ProfileSettings({user,onSave,onPasswordChange,onPrivacy,onTerms,onClearData,transactionCount,goalCount}){
 const [name,setName]=useState(user.name),[occupation,setOccupation]=useState(user.occupation),[currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[passwordMessage,setPasswordMessage]=useState('');
 const saveProfile=event=>{event.preventDefault();onSave(name.trim(),occupation.trim());};
 const updatePassword=async event=>{
  event.preventDefault();
  setPasswordMessage('');
  if(newPassword!==confirmPassword){setPasswordMessage('The new passwords do not match.');return;}
  try{
   const message=await onPasswordChange(currentPassword,newPassword);
   setPasswordMessage(message||'Password updated on this device.');
   if(!message){setCurrentPassword('');setNewPassword('');setConfirmPassword('');}
  }catch(error){setPasswordMessage(error.message||'Could not update password.');}
 };
 return <><PageIntro eyebrow="ACCOUNT & PREFERENCES" title={<>Your profile, <em>your settings.</em></>} desc="Manage your local account, security, and stored financial data."/><div className="settings-layout"><section className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><Settings2 size={18}/></span><div><h3>Profile details</h3><p>Used to personalize your workspace.</p></div></div><form className="settings-form" onSubmit={saveProfile}><label>Full name<input value={name} onChange={event=>setName(event.target.value)} required/></label><label>Occupation<input value={occupation} onChange={event=>setOccupation(event.target.value)} required/></label><label>Email address<input value={user.email} disabled/></label><button className="button button-dark" type="submit">Save profile</button></form></section><section className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><ShieldCheck size={18}/></span><div><h3>Password & security</h3><p>Hashed locally; this is not server authentication.</p></div></div><form className="settings-form" onSubmit={updatePassword}><label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} required/></label><label>New password<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event=>setNewPassword(event.target.value)} required/></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} required/></label>{passwordMessage&&<p className="form-message" role="status">{passwordMessage}</p>}<button className="button button-dark" type="submit">Update password</button></form></section><section className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><Wallet size={18}/></span><div><h3>Regional preferences</h3><p>Numbers are displayed in Indian Rupees.</p></div></div><div className="settings-preference"><span>Currency</span><b>Indian Rupee · INR (₹)</b></div><div className="settings-preference"><span>Transactions stored</span><b>{transactionCount}</b></div><div className="settings-preference"><span>Goals stored</span><b>{goalCount}</b></div></section><section className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><FileText size={18}/></span><div><h3>Privacy & data</h3><p>Review how local profile data is handled.</p></div></div><div className="settings-link-row"><button className="text-button" onClick={onPrivacy}>Privacy policy <ArrowRight size={14}/></button><button className="text-button" onClick={onTerms}>Terms & conditions <ArrowRight size={14}/></button></div><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="button button-outline danger-button" onClick={onClearData}>Clear this profile’s financial data</button><button className="button button-outline danger-button" onClick={()=>{if(window.confirm('Wipe ALL stored data and accounts from this browser?')){localStorage.clear();sessionStorage.clear();window.location.reload();}}}>Reset & wipe all browser data</button></div></section></div></>;
}

function ContactPage({user,onSubmit}){
 const [subject,setSubject]=useState(''),[message,setMessage]=useState(''),[status,setStatus]=useState('');
 const submit=async event=>{
  event.preventDefault();
  setStatus('');
  try{
   await onSubmit({name:user.name,email:user.email,subject:subject.trim(),message:message.trim()});
   setSubject('');
   setMessage('');
   setStatus('Saved in this browser only. The request has not been sent to a support team.');
  }catch(error){setStatus(error.message||'Could not save your help request.');}
 };
 return <><PageIntro eyebrow="HELP & SUPPORT" title={<>How can we <em>help you?</em></>} desc="Send a note about the product or your local profile."/><section className="panel contact-card"><div className="settings-card-heading"><span className="settings-icon"><CircleHelp size={18}/></span><div><h3>Contact us</h3><p>Tell us what you need help with.</p></div></div><form className="settings-form" onSubmit={submit}><label>Your name<input value={user.name} disabled/></label><label>Reply email<input value={user.email} disabled/></label><label>Subject<input value={subject} onChange={event=>setSubject(event.target.value)} maxLength={120} required/></label><label>Message<textarea value={message} onChange={event=>setMessage(event.target.value)} rows={6} maxLength={4000} required placeholder="Describe the issue or question."/></label>{status&&<p className="form-message" role="status">{status}</p>}<button className="button button-dark" type="submit">Save help request</button></form><p className="local-only-note">This frontend has no support server or inbox connected. Requests are saved only in your browser and are not delivered to anyone.</p></section></>;
}

function LegalPage({type,onBack}){
 return <><div className="legal-page-head"><PageIntro eyebrow="ACCOUNT INFORMATION" title={type==='Privacy policy'?<>Privacy <em>policy.</em></>:<>Terms & <em>conditions.</em></>} desc="Information about this device-local prototype."/><button className="button button-outline" onClick={onBack}>Back to settings</button></div><section className="panel legal-page"><LegalContent type={type}/></section></>;
}

function PageIntro({eyebrow,title,desc}){return <div className="page-heading inner-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="subtitle">{desc}</p></div></div>}
function DailyTrack({records,onImport}){
 const income=records.reduce((sum,day)=>sum+day.income,0);
 const expenses=records.reduce((sum,day)=>sum+day.expenses,0);
 return <><PageIntro eyebrow="YOUR DAY-BY-DAY HISTORY" title={<>Every day, <em>clearly accounted for.</em></>} desc="Daily totals and transactions from activity you imported into this profile."/><div className="daily-summary"><div className="panel daily-summary-card"><span>RECORDED DAYS</span><b>{records.length}</b></div><div className="panel daily-summary-card"><span>RECORDED INCOME</span><b>{money(income)}</b></div><div className="panel daily-summary-card"><span>RECORDED SPENDING</span><b>{money(expenses)}</b></div></div>{records.length===0?<section className="panel daily-empty"><CalendarDays size={25}/><h2>No daily records yet</h2><p>Import a bank alert or statement to create a day-by-day record. Nothing has been prefilled.</p><button className="button button-dark" onClick={onImport}><Upload size={15}/> Import transactions</button></section>:<div className="daily-record-list">{records.map(day=><section className="panel daily-record" key={day.date}><header className="daily-record-head"><div className="daily-date"><CalendarDays size={17}/><div><time dateTime={day.date}>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</time><span>{day.transactions.length} transaction{day.transactions.length===1?'':'s'} recorded</span></div></div><div className="daily-totals"><span>Income <b>{money(day.income)}</b></span><span>Spending <b>{money(day.expenses)}</b></span><span>Net <b className={day.net>=0?'positive':'negative'}>{money(day.net)}</b></span></div></header><div className="daily-transactions">{day.transactions.map(transaction=><div className="daily-transaction" key={transaction.id}><div className="merchant-mark">{transaction.merchant.slice(0,1)}</div><div className="daily-transaction-copy"><b>{transaction.merchant}</b><span>{transaction.category}</span></div><b className={`daily-amount ${transaction.amount>0?'positive':'negative'}`}>{transaction.amount>0?'+':''}{money(transaction.amount)}</b></div>)}</div></section>)}</div>}</>;
}
function NotificationCenter({items,unreadCount,open,setOpen,onMarkRead,onOpen,seen}){
 return <div className="notification-center"><button className={`notification-launcher ${open?'open':''}`} aria-expanded={open} aria-label={`Notifications${unreadCount?`, ${unreadCount} unread`:''}`} onClick={()=>setOpen(!open)}><Bell size={17}/><span>Notifications</span>{unreadCount>0&&<b>{unreadCount>9?'9+':unreadCount}</b>}</button>{open&&<section className="notification-popover" role="region" aria-label="Notifications"><header><div><span className="eyebrow">YOUR PROFILE ACTIVITY</span><h2>Notifications</h2></div>{unreadCount>0&&<button className="text-button" onClick={onMarkRead}>Mark all read</button>}</header>{items.length===0?<p className="notification-caught-up">You’re all caught up.</p>:<div className="notification-list">{items.map(item=><button className={`notification-item ${seen.includes(item.id)?'read':'unread'}`} key={item.id} onClick={()=>onOpen(item)}><span className="notification-indicator"><Bell size={14}/></span><span><b>{item.title}</b><small>{item.message}</small><i>Open {item.view.toLowerCase()} <ArrowRight size={12}/></i></span></button>)}</div>}</section>}</div>;
}
function TransactionTable({rows,categorize}){let cats=['Dining','Groceries','Shopping','Transport','Subscriptions','Housing','Utilities','Insurance','Income','Other'];return <div className="table-wrap"><table className="transaction-table"><thead><tr><th>MERCHANT</th><th>DATE</th><th>CATEGORY</th><th className="align-right">AMOUNT</th></tr></thead><tbody>{rows.map(tx=><tr key={tx.id}><td><div className="merchant-cell"><div className="merchant-mark">{tx.merchant.slice(0,1)}</div><b>{tx.merchant}</b></div></td><td>{new Date(tx.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td><td><select className="category-select" value={tx.category} onChange={e=>categorize(tx,e.target.value)}>{cats.map(c=><option key={c}>{c}</option>)}</select></td><td className={`align-right mono ${tx.amount>0?'text-green':''}`}>{tx.amount>0?'+':''}{money(tx.amount)}</td></tr>)}</tbody></table>{rows.length===0&&<div className="empty-state">No transactions match that search.</div>}</div>}
function ProfileIngestion({onFile,smsParse,add,notify}){const [sms,setSms]=useState(''),[parsed,setParsed]=useState([]),[tab,setTab]=useState('sms');return <section className="panel ingestion-panel"><div className="panel-header"><div><h3>Import your financial activity</h3><p>Paste a bank alert or choose a statement from your device.</p></div><span className="pill pill-green"><ShieldCheck size={13}/> Processed locally</span></div><div className="ingest-tabs"><button className={tab==='sms'?'selected':''} onClick={()=>setTab('sms')}><MessageCircle size={15}/> Bank alert</button><button className={tab==='csv'?'selected':''} onClick={()=>setTab('csv')}><FileText size={15}/> CSV statement</button><button className={tab==='pdf'?'selected':''} onClick={()=>setTab('pdf')}><Upload size={15}/> PDF statement</button></div>{tab==='sms'?<div className="ingest-content"><label className="field-label">Paste transaction alerts <span>One alert per line</span></label><textarea value={sms} onChange={event=>setSms(event.target.value)} placeholder="Paste your own bank or card alerts here."/><div className="ingest-footer"><span className="text-muted">Nothing is pre-filled.</span><button className="button button-dark" onClick={()=>{const transactions=smsParse(sms);setParsed(transactions);if(!transactions.length)notify('No transactions found. Check the alert format and try again.')}}><Sparkles size={14}/> Parse alerts</button></div></div>:<div className="ingest-content upload-content"><div className="upload-zone"><div className="upload-icon"><Upload size={21}/></div><b>Choose your {tab==='csv'?'CSV':'PDF'} statement</b><span>Files are read in this browser.</span><label className="button button-outline file-btn">Browse files<input type="file" accept={tab==='csv'?'.csv,text/csv':'.pdf,application/pdf'} onChange={event=>onFile(event.target.files[0])}/></label></div><div className="sample-actions"><span>YOUR DATA</span><p className="upload-privacy">Your statement is parsed locally and added only to this email profile.</p></div></div>}{parsed.length>0&&<div className="parsed-preview"><div className="panel-header"><div><h3>Review imported alerts</h3><p>{parsed.length} transactions found</p></div><button className="button button-dark" onClick={()=>{add(parsed);setParsed([]);setSms('');notify('Transactions added to your local profile.')}}>Add to ledger <ArrowRight size={14}/></button></div><TransactionTable rows={parsed} categorize={()=>{}}/></div>}<div className="ingest-tip"><ShieldCheck size={14}/><span>Your financial data stays in this browser and is stored separately for each email profile.</span></div></section>}
function RuleRegistry({rules,remove}){return <div className="rule-registry"><div className="registry-head"><span>MERCHANT KEYWORD</span><span>LEARNED CATEGORY</span><span/></div>{rules.length?rules.map(r=><div className="rule-row" key={r.keyword}><span className="keyword-chip">{r.keyword}</span><span>{r.category}</span><button className="icon-btn" title="Delete rule" onClick={()=>remove(r)}><X size={15}/></button></div>):<p className="empty-rules">No learned rules yet. Change a transaction category in the ledger to teach your model.</p>}</div>}
function Summary({label,value,icon:Icon}){return <div className="summary-card"><div className="metric-label">{label}<Icon size={16}/></div><b>{value}</b></div>}
function MoneyField({label,value,onChange,step}){return <label className="money-field"><span>{label}</span><div>{label.includes('months')?null:<span>₹</span>}<input type="number" step={step||50} value={value||''} onChange={e=>onChange(e.target.value)}/></div></label>}
function WhatIf({scenario,setScenario,delta,goals,commit}){let [preset,setPreset]=useState('');let save=(key,value)=>setScenario({...scenario,[key]:value});let fmt=value=>value>0?`+${money(value)}`:money(value);return <section className="panel whatif-panel"><div className="panel-header"><div><span className="eyebrow">SCENARIO SANDBOX</span><h3>What if life changes a little?</h3><p>Explore possible changes before updating your profile.</p></div><span className="pill pill-neutral"><Activity size={13}/> Your inputs</span></div><div className="preset-row"><span>SIMULATION SLIDERS</span><small className="text-muted">Adjust any slider below to test financial scenarios</small></div><div className="sim-grid"><div className="sliders">{[['dining','Reduce dining & delivery',0,60,'%'],['shopping','Reduce discretionary shopping',0,50,'%'],['rent','Monthly essential cost change',-50000,100000,'₹'],['income','Monthly income change',0,300000,'₹']].map(([key,label,min,max,unit])=><label className="slider-field" key={key}><span>{label}</span><b>{unit==='₹'?fmt(scenario[key]):`${scenario[key]}%`}</b><input type="range" min={min} max={max} step={unit==='₹'?2500:5} value={scenario[key]} onChange={event=>save(key,Number(event.target.value))}/><small>{unit==='₹'?(min<0?`Save ${money(Math.abs(min))} less`:'No change'):'0%'} <i>{unit==='₹'?`+${money(max)}`:`${max}%`}</i></small></label>)}</div><div className="sim-result"><span className="eyebrow">PROJECTED MONTHLY CHANGE</span><b className={delta>=0?'positive':'negative'}>{fmt(delta)}<small>/mo</small></b><p>{delta>=0?'More room in the plan.':'Less room in the plan.'}</p>{goals.length>0&&<div className="impact-row"><span>Goals in this profile</span><b>{goals.length}</b></div>}<button className="button button-dark commit-btn" onClick={commit}><Check size={15}/> Apply changes to profile</button></div></div></section>}

createRoot(document.getElementById('root')).render(<App/>);
