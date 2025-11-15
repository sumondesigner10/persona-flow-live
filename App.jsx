// PersonaFlow AI: Global Identity Studio
// Features: International Character Generation, Subscription Tiers, 109 Professions,
// High-Quality Output (JPG), Sequential Download, and Advanced UI Controls.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, orderBy, onSnapshot, serverTimestamp, deleteDoc } from 'firebase/firestore';

// --- Global Variables and Libraries ---
// Firestore Configuration (Provided by Canvas Environment)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 
const API_KEY = ""; // Gemini API Key is automatically handled by the environment

// --- Configuration Constants ---
const EST_TIME_PER_IMAGE_SECONDS = 20; 
const BATCH_SIZE = 4; // Max parallel generations

// --- Subscription Tiers and Limits (Simulated for Demo/Testing) ---
const USER_TIERS = {
    // FIX: Setting default tier to AGENCY to UNLOCK ALL features as requested by user.
    FREE: { 
        cap: 5, 
        maxResolutionPrompt: "very high quality, high resolution", // Max HD
        unlockMessage: "PRO টায়ারে আপগ্রেড করুন" 
    },
    PROFESSIONAL: { 
        cap: 1000, 
        maxResolutionPrompt: "Ultra HD, 8K, best quality, professional print quality", // Max Ultra HD
        unlockMessage: "এজেন্সি টায়ারে আপগ্রেড করুন" 
    },
    AGENCY: { 
        cap: Infinity, 
        maxResolutionPrompt: "Print quality master file, extreme detail, super resolution", // Max Print Master
        unlockMessage: "সমস্ত বৈশিষ্ট্য আনলক করা হয়েছে" 
    },
};

// --- Output Resolution Options ---
const RESOLUTION_OPTIONS = [
    { bn: "স্ট্যান্ডার্ড (SD)", en: "1024x1024", quality_prompt: "high quality", requiredTier: 'FREE' },
    { bn: "HD (প্রস্তাবিত)", en: "1536x1536", quality_prompt: "very high quality, high resolution", requiredTier: 'FREE' },
    { bn: "আল্ট্রা HD (প্রিমিয়াম)", en: "2048x2048", quality_prompt: "Ultra HD, 8K, best quality, professional print quality", requiredTier: 'PROFESSIONAL' },
    { bn: "প্রিন্ট মাস্টার (PRO)", en: "3072x3072", quality_prompt: "Print quality master file, extreme detail, super resolution", requiredTier: 'AGENCY' },
];

// --- Aspect Ratio Options ---
const ASPECT_RATIO_OPTIONS = [
    { bn: "পোর্ট্রেট (4:5)", en: "4:5 aspect ratio, ideal for social media" },
    { bn: "ল্যান্ডস্কেপ (16:9)", en: "16:9 aspect ratio, ideal for video or banner ads" },
    { bn: "স্কোয়ার (1:1)", en: "1:1 aspect ratio, classic profile picture style" },
];

// --- Camera Angle/Shot Selection (NEW FEATURE for Commercial Control) ---
const CAMERA_ANGLE_OPTIONS = [
    { bn: "ক্লোজ-আপ", en: "tight close-up shot, focusing on face and shoulders, detailed expression" },
    { bn: "মিডিয়াম শট", en: "medium chest-up shot, clearly showing the upper body and attire" },
    { bn: "ফুল বডি শট", en: "full body shot, showing complete professional attire and environment" },
    { bn: "ওভার-দ্য-শোল্ডার", en: "over-the-shoulder shot, showing subject looking forward with depth" },
];


// --- Country/Regional Context Options (NEW FEATURE) ---
const COUNTRY_CONTEXT_OPTIONS = [
    { bn: "বাংলাদেশ (BD)", en: "Bangladeshi, South Asian cultural context" },
    { bn: "মার্কিন যুক্তরাষ্ট্র (USA)", en: "American cultural context, modern US background" },
    { bn: "মধ্যপ্রাচ্য (Dubai/KSA)", en: "Middle Eastern cultural context, modern urban or desert background, appropriate traditional or corporate attire" },
    { bn: "ইউরোপ (Europe)", en: "Western European cultural context, classic European corporate background" },
];


// --- 109 Bangladeshi Professional Characters (FINAL LIST) ---
const CHARACTER_CATEGORIES = {
  "চিকিৎসা ও স্বাস্থ্য (7)": [
    { bn: "ডাক্তার", en: "Doctor, working in a hospital" },
    { bn: "সার্জন", en: "Surgeon, wearing surgery scrubs, focused expression" },
    { bn: "নার্স", en: "Nurse, wearing a uniform, caring expression" },
    { bn: "ফার্মাসিস্ট", en: "Pharmacist, in a pharmacy setting, wearing a lab coat" },
    { bn: "ল্যাব টেকনিশিয়ান", en: "Lab Technician, wearing protective glasses, handling scientific equipment" },
    { bn: "দন্ত চিকিৎসক", en: "Dentist, wearing a mask and gloves, white clinic background" },
    { bn: "প্যারামেডিক", en: "Paramedic, wearing high-visibility vest, near an ambulance" },
  ],
  "ইঞ্জিনিয়ারিং ও টেকনিক্যাল (7)": [
    { bn: "সিভিল ইঞ্জিনিয়ার", en: "Civil Engineer, wearing a hard hat and safety vest, construction site background" },
    { bn: "ইলেকট্রিক্যাল ইঞ্জিনিয়ার", en: "Electrical Engineer, inspecting wiring and schematics" },
    { bn: "মেকানিক্যাল ইঞ্জিনিয়ার", en: "Mechanical Engineer, working on heavy machinery" },
    { bn: "সফটওয়্যার ইঞ্জিনিয়ার", en: "Software Developer, in a modern office, surrounded by monitors" },
    { bn: "আর্কিটেক্ট", en: "Architect, holding blueprints and a rolled drawing" },
    { bn: "টেক্সটাইল ইঞ্জিনিয়ার", en: "Textile Engineer, inspecting fabric in a mill" }, 
    { bn: "কম্পিউটার হার্ডওয়্যার ইঞ্জিনিয়ার", en: "Computer Hardware Engineer, examining a detailed circuit board, technical setting" },
  ],
  "শিক্ষা ও প্রশিক্ষণ (7)": [
    { bn: "স্কুল শিক্ষক", en: "School Teacher, standing in a classroom with a friendly smile" },
    { bn: "কলেজ শিক্ষক", en: "College Professor, wearing formal attire, standing near a whiteboard" },
    { bn: "প্রাইভেট টিউটর", en: "Private Tutor, teaching a young student one-on-one, calm indoor setting" },
    { bn: "শিক্ষণ কনসালট্যান্ট", en: "Education & Training Consultant, presenting educational material with enthusiasm" },
    { bn: "ভার্সিটি অধ্যাপক", en: "University Professor, wearing academic gown or formal western suit, lecturing" },
    { bn: "লাইব্রেরিয়ান", en: "Librarian, standing among bookshelves, wearing glasses, thoughtful expression" },
    { bn: "গবেষক", en: "Researcher/Scientist, working with scientific instruments, focused and analytical" },
  ],
  "কর্পোরেট ও পরামর্শ (11)": [
    { bn: "ম্যানেজার", en: "Manager, wearing a smart suit, confident posture in a meeting room" },
    { bn: "অ্যাকাউন্ট্যান্ট", en: "Accountant, wearing glasses, working meticulously on ledgers" },
    { bn: "ব্যাংকার", en: "Banker, wearing professional attire, interacting with a client at a counter" },
    { bn: "HR", en: "HR Professional, conducting an interview, smiling warmly" },
    { bn: "সেলস এক্সিকিউটিভ", en: "Sales Executive, dynamic pose, holding a tablet" },
    { bn: "মার্কেটিং অফিসার", en: "Marketing Officer, brainstorming creative ideas in a modern setup" },
    { bn: "উদ্যোক্তা", en: "Entrepreneur, looking visionary, standing in front of a city skyline" },
    { bn: "পাবলিক স্পিকার", en: "Public Speaker, standing on a large stage, confident body language" },
    { bn: "লাইফ কোচ", en: "Life Coach/Motivator, sitting in a clean, modern office, engaged and empathetic" },
    { bn: "ইনভেস্টমেন্ট ব্যাঙ্কার", en: "Investment Banker, wearing a luxurious suit, looking powerful and strategic" },
    { bn: "ভেনচার ক্যাপিটালিস্ট", en: "Venture Capitalist, sitting in a minimalist high-end meeting room, sharp attire" },
  ],
  "তথ্যপ্রযুক্তি ও অনলাইন সার্ভিস (9)": [
    { bn: "সফটওয়্যার ডেভেলপার", en: "Software Developer, wearing casual tech clothing, coding late night" },
    { bn: "ওয়েব ডেভেলভার", en: "Web Developer, working on multiple screens, focused" }, 
    { bn: "গ্রাফিক ডিজাইনার", en: "Graphic Designer, holding a stylus pen, colorful artistic background" },
    { bn: "ডেটা অ্যানালিস্ট", en: "Data Analyst, serious expression, looking at complex charts" },
    { bn: "সাইবার সিকিউরিটি", en: "Cyber Security Expert, in a dark, futuristic server room" },
    { bn: "UI/UX ডিজাইনার", en: "UI/UX Designer, sketching wireframes in a notebook" },
    { bn: "ই-কমার্স ম্যানেজার", en: "E-commerce Manager, looking at sales data on a monitor, surrounded by products" },
    { bn: "অনলাইন সাপোর্ট এজেন্ট", en: "Online Service Support Agent, wearing a headset, smiling at the screen" },
    { bn: "পেশাদার গেমার", en: "Professional Gamer (Esports Player), wearing high-tech headphones, intense focus" },
  ],
  "নিরাপত্তা ও পরিবহন (10)": [
    // FINAL FIX: Strict BD Uniform Accuracy
    { bn: "পুলিশ", en: "Highly detailed, photorealistic 8K image of a Police Officer, wearing the standard dark navy blue uniform, clear shoulder epaulets, and cap. **STRICTLY AVOID visible name badges, text, logos, flags, or insignias**. Must look like an unedited professional photo." },
    { bn: "আর্মি", en: "Highly detailed, photorealistic 8K image of an Army Soldier, wearing the standard Olive Green Camouflage uniform, stern expression, **STRICTLY AVOID visible text, logos, flags, or rank insignias**. Must look like an unedited professional photo." },
    { bn: "নৌবাহিনী", en: "Highly detailed, photorealistic 8K image of a Navy Officer, wearing the standard dark navy or white ceremonial uniform, confident pose, **STRICTLY AVOID insignias, logos, or visible text**. Must look like an unedited professional photo." },
    { bn: "বিমানবাহিনী", en: "Highly detailed, photorealistic 8K image of an Air Force Pilot, wearing a green flight suit and helmet, in a cockpit or near an aircraft, **STRICTLY AVOID any logos or real text**. Must look like an unedited professional photo." },
    { bn: "ফায়ার সার্ভিস", en: "Firefighter, wearing protective gear and helmet, near a fire truck, **Avoid logos or specific insignias**." },
    { bn: "বাস ড্রাইভার", en: "Bus Driver, wearing a uniform, sitting in the bus cabin" },
    { bn: "ট্রাক ড্রাইভার", en: "Truck Driver, rugged look, sitting in a truck cabin" },
    { bn: "রিকশা চালক", en: "Rickshaw Puller, wearing simple clothing, smiling warmly on a busy street" },
    { bn: "ডেলিভারি ম্যান (কুরিয়ার)", en: "Delivery Man, wearing courier uniform, holding a package on a bike" },
    { bn: "শিপিং/বন্দর শ্রমিক", en: "Shipping/Port Worker, wearing a hardhat and safety vest, next to cargo containers" },
  ],
  "বাজার ও খুচরা ব্যবসা (8)": [
    { bn: "কাঁচা বাজার বিক্রেতা", en: "Raw Vegetable Market Vendor, sitting amongst fresh produce" },
    { bn: "মাছ বিক্রেতা", en: "Fish Seller, standing by a pile of fresh fish" },
    { bn: "সবজি বিক্রেতা", en: "Vegetable Vendor, wearing simple clothes, selling vegetables by the roadside" },
    { bn: "মাংস ব্যবসায়ী", en: "Meat Butcher, working at a stall with a sharp knife" },
    { bn: "চা-ওয়ালা", en: "Tea Stall Owner (Cha-wala), pouring tea from a kettle on a small stall" },
    { bn: "ফল বিক্রেতা", en: "Fruit Seller, arranging fresh seasonal fruits" },
    { bn: "ফ্যাশন ও গার্মেন্টস বিক্রেতা", en: "Fashion & Apparel Seller, standing confidently near racks of stylish clothing" },
    { bn: "মুদি দোকানদার", en: "Grocery Store Owner, standing behind the counter of a small shop" },
  ],
  "হস্তশিল্প ও কারিগর (8)": [
    { bn: "মুচি (শু রিপেয়ার)", en: "Cobbler/Shoe Repairer, sitting by the roadside with tools" },
    { bn: "দর্জি (টেইলার)", en: "Tailor, working intently on a sewing machine" },
    { bn: "কার্পেন্টার", en: "Carpenter, working with wood and sawdust, holding a hammer" },
    { bn: "ইলেকট্রিশিয়ান", en: "Electrician, fixing a light fixture, holding wires" },
    { bn: "প্লাম্বার", en: "Plumber, wearing overalls, fixing a pipe" },
    { bn: "মেকানিক", en: "Mechanic, greasy hands, working under a vehicle" },
    { bn: "জুয়েলারি কারিগর", en: "Jewelry Artisan, working meticulously with fine gold or silver pieces" },
    { bn: "প্রিন্টিং অপারেটর", en: "Printing & Packaging Operator, standing next to a large printing machine" },
  ],
  "খাদ্য ও রেস্টুরেন্ট (5)": [
    { bn: "রাঁধুনি (Chef)", en: "Chef, wearing a chef hat and apron, working in a commercial kitchen" },
    { bn: "হোটেল কর্মী", en: "Hotel Staff, wearing a neat uniform, greeting guests" },
    { bn: "ওয়েটার", en: "Waiter, serving food with a tray, professional demeanor" },
    { bn: "বেকারি কর্মী", en: "Bakery Worker, holding freshly baked bread" }, 
    { bn: "ফুড ডেলিভারি রাইডার", en: "Food Delivery Rider, wearing a branded uniform, holding a thermal bag on a motorcycle" },
  ],
  "মিডিয়া, বিজ্ঞাপন ও বিনোদন (10)": [
    { bn: "সাংবাদিক", en: "Journalist/Reporter, holding a microphone in front of a news scene" },
    { bn: "ইউটিউবার", en: "Youtuber/Vlogger, holding a camera, lively expression" },
    { bn: "ফটোগ্রাফার", en: "Photographer, holding a professional camera, eye behind the viewfinder" },
    { bn: "ভিডিও এডিটর", en: "Video Editor, sitting in a dark room with color-graded footage on screen" },
    { bn: "অভিনেতা", en: "Actor, dramatic lighting, expressive face on a stage" },
    { bn: "গায়ক", en: "Singer, holding a microphone, performing passionately" },
    { bn: "পডকাস্টার", en: "Podcaster, sitting in a soundproof studio with a high-quality microphone" },
    { bn: "ব্লগার/ইনফ্লুয়েন্সার", en: "Blogger/Influencer, posing attractively with a branded product, soft lighting" },
    { bn: "বিজ্ঞাপন সংস্থার নির্বাহী", en: "Advertising Agency Executive, pointing to a creative ad campaign on a large screen" },
    { bn: "ইভেন্ট ম্যানেজার", en: "Event Manager, coordinating a large event, wearing a headset" },
  ],
  "গ্রামীণ ও কৃষি (6)": [
    { bn: "কৃষক", en: "Farmer, wearing traditional rural clothes, working in a paddy field" },
    { bn: "মৎস্যজীবী", en: "Fisherman, holding a fishing net by a river or pond" },
    { bn: "গরু–ছাগল পালনকারী", en: "Cattle/Goat Herder, standing with livestock in a grassy field" },
    { bn: "তাঁতি", en: "Weaver (Tanti), sitting at a handloom, working with threads" },
    { bn: "নৌকাচালক", en: "Boatman/Boat Driver, rowing a wooden boat on a river, serene environment" },
    { bn: "কৃষি বিজ্ঞানী", en: "Agricultural Scientist, examining a healthy crop sample in a modern lab coat" },
  ],
  "রিয়েল এস্টেট ও হোম সার্ভিস (4)": [
    { bn: "রিয়েল এস্টেট এজেন্ট", en: "Real Estate Agent, wearing professional attire, holding keys in front of a modern house" },
    { bn: "ইন্টেরিয়র ডিজাইনার", en: "Interior Designer, reviewing fabric samples and floor plans" },
    { bn: "ফার্নিচার নির্মাতা", en: "Furniture Maker, sanding a wooden chair in a workshop" },
    { bn: "ক্লিনিং সার্ভিস সুপারভাইজার", en: "Cleaning & Maintenance Supervisor, wearing a uniform, checking on equipment" },
  ],
  "সৌন্দর্য ও ব্যক্তিগত যত্ন (3)": [
    { bn: "বিউটিশিয়ান/হেয়ার স্টাইলিস্ট", en: "Beautician/Hair Stylist, giving a haircut or styling hair in a salon" },
    { bn: "মেকআপ আর্টিস্ট", en: "Makeup Artist, applying makeup to a model, focused and precise" },
    { bn: "পারফিউম বিক্রেতা", en: "Beauty & Personal Care Product Salesperson, presenting a luxury perfume bottle" },
  ],
  "অন্যান্য বিশেষায়িত পেশা (10)": [
    { bn: "ব্যাংকার", en: "Banker, wearing professional attire, interacting with a client at a counter" },
    { bn: "অটোমোবাইল ডিলার", en: "Automobile & Vehicle Dealer, standing next to a shiny new car" },
    { bn: "টেলিকম টেকনিশিয়ান", en: "Telecommunication Technician, working on a server tower or large antenna" },
    { bn: "পাওয়ার প্ল্যান্ট ইঞ্জিনিয়ার", en: "Energy & Power Engineer, wearing a safety helmet in a power generation facility" },
    { bn: "ট্রাভেল এজেন্ট", en: "Travel & Tourism Agent, sitting at a desk with maps and travel brochures" },
    { bn: "স্পোর্টস ট্রেনার", en: "Sports & Fitness Trainer, wearing athletic gear, motivating a client in a gym" },
    { bn: "হোম অ্যাপ্লায়েন্স বিক্রেতা", en: "Home Appliance Salesperson, showing a modern appliance to a customer" },
    { bn: "বেবি প্রোডাক্ট বিক্রেতা", en: "Baby & Kids Product Seller, holding a toy or baby item with a gentle expression" },
    { bn: "সিকিউরিটি গার্ড", en: "Security & Surveillance Guard, wearing a uniform, standing watch at an entrance" },
    { bn: "এনার্জি কনসালট্যান্ট", en: "Energy Consultant, in a modern green office, discussing renewable energy" },
  ]
};

const ALL_PROFESSIONS = Object.values(CHARACTER_CATEGORIES).flat();
// Total Professions Count is 109

const STYLE_PRESETS = [
  { bn: "বাস্তবসম্মত (Photoreal)", en: "Ultra HD, 8K, best quality, cinematic lighting, photorealistic, no visible brushstrokes" },
  { bn: "সিনেমাটিক", en: "Dramatic lighting, deep colors, film grain, cinematic shot composition" },
  { bn: "স্টুডিও পোর্ট্রেট", en: "Clean background, sharp focus, perfect studio soft-box lighting, crisp details" },
  { bn: "হাই-এন্ড ফ্যাশন", en: "Magazine cover quality, glamorous, high-dynamic range, professional retouching" },
  { bn: "ডকুমেন্টারি", en: "Natural lighting, slight grain texture, authentic, candid, raw photo style" },
  { bn: "লো-লাইট নুয়ান্স", en: "Mysterious, soft rim lighting, deep shadows, low-key, professional portrait" },
  { bn: "জলরঙ (Watercolor)", en: "Watercolor painting style, soft edges, vibrant colors, artistic texture" },
  { bn: "কমিক বুক", en: "Bold lines, vibrant flat colors, comic book illustration style, dot pattern" },
];

const TONE_PRESETS = [
  { bn: "গুরুত্বপূর্ণ (Serious)", en: "serious and determined expression" },
  { bn: "হাসি-খুশি (Smiling)", en: "warm, friendly, and authentic smile" },
  { bn: "চিন্তিত (Thoughtful)", en: "pensive, deep and thoughtful gaze" },
  { bn: "শান্ত (Calm)", en: "relaxed, peaceful, and composed expression" },
  { bn: "আশাবাদী (Optimistic)", en: "hopeful and bright expression" },
];

// --- Utility Functions ---

const MAX_RETRIES = 5;
const INITIAL_DELAY = 1000;

const exponentialBackoffFetch = async (url, options, retries = 0) => {
  try {
    const response = await fetch(url, options);
    if (!response.ok && response.status !== 429 && retries < MAX_RETRIES) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    if (!response.ok && retries < MAX_RETRIES) {
        // Only retry on non-OK status or explicitly retryable status like 429
        const delay = INITIAL_DELAY * Math.pow(2, retries) + Math.random() * 1000;
        // console.warn(`Request failed. Retrying in ${delay / 1000}s... (Attempt ${retries + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return exponentialBackoffFetch(url, options, retries + 1);
    }
    if (!response.ok) {
         // console.error(`Max retries reached. Final status: ${response.status}`);
         return response; // Return response to be handled by caller
    }
    return response;
  } catch (error) {
    if (retries < MAX_RETRIES) {
        const delay = INITIAL_DELAY * Math.pow(2, retries) + Math.random() * 1000;
        // console.warn(`Fetch failed. Retrying in ${delay / 1000}s... (Attempt ${retries + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return exponentialBackoffFetch(url, options, retries + 1);
    }
    // console.error('Max retries reached. Final error:', error);
    throw error;
  }
};

// Function to convert Base64 PNG to Base64 JPG with high quality (0.98)
const convertPngToJpg = (pngBase64) => {
    return new Promise((resolve) => {
        // If not a data URL or not PNG, skip conversion logic (API returns PNG typically)
        if (!pngBase64.startsWith('data:image/png')) {
            resolve(pngBase64.replace(/^data:image\/[^;]+;base64,/, 'data:image/jpeg;base64,'));
            return;
        }

        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            // FIX: Increased quality to 0.98 for larger file size and better quality
            const jpgBase64 = canvas.toDataURL('image/jpeg', 0.98); 
            resolve(jpgBase64);
        };
        img.onerror = function() {
            // Fallback: If image loading fails, return original Base64 (as JPG)
             resolve(pngBase64.replace(/^data:image\/[^;]+;base64,/, 'data:image/jpeg;base64,'));
        }
        img.src = pngBase64;
    });
};


// --- React Application ---

export default function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // --- Subscription & Cap States (Simulated) ---
  // FIX: Setting default tier to AGENCY to UNLOCK ALL features as requested by user.
  const [currentTier, setCurrentTier] = useState('AGENCY'); 
  const [dailyGenerations, setDailyGenerations] = useState(0); // Simulated count
  const userLimits = USER_TIERS[currentTier] || USER_TIERS.FREE; // Get current limits

  const [uploadedImage, setUploadedImage] = useState(null); // base64 or data URL
  const [secondaryUploadedImage, setSecondaryUploadedImage] = useState(null); // New state for reference image (Optional)
  const [generatedImages, setGeneratedImages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [completedCount, setCompletedCount] = useState(0); 
  const [estimatedTime, setEstimatedTime] = useState(null); 

  const [isReadyForGeneration, setIsReadyForGeneration] = useState(false); 
  const [selectedResolution, setSelectedResolution] = useState(RESOLUTION_OPTIONS[3].quality_prompt); // Default to PRO Print Master
  const [selectedAspect, setSelectedAspect] = useState(ASPECT_RATIO_OPTIONS[2].en); // Default to Square
  // New State for Country Context
  const [selectedCountryContext, setSelectedCountryContext] = useState(COUNTRY_CONTEXT_OPTIONS[0].en); 
  // New State for Camera Angle
  const [selectedCameraAngle, setSelectedCameraAngle] = useState(CAMERA_ANGLE_OPTIONS[1].en); 


  const [selectedProfessions, setSelectedProfessions] = useState(ALL_PROFESSIONS.map(p => p.en)); 
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0].en);
  const [selectedTone, setSelectedTone] = useState(TONE_PRESETS[1].en);
  const [customBackground, setCustomBackground] = useState('');
  const [selectedGender, setSelectedGender] = useState('Male'); 

  const [savedPrompts, setSavedPrompts] = useState([]);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // NEW STATE for Payment Modal (for better UX)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState(''); // Search state for professions
  
  // Favorites/Tagging State
  const [favoriteProfessions, setFavoriteProfessions] = useState([]);
  const FAVORITES_KEY = 'ai_portraits_favorites';


  // --- Firebase Initialization and Auth ---
  useEffect(() => {
    try {
      if (Object.keys(firebaseConfig).length === 0) {
        // console.error("Firebase config is empty. Cannot initialize.");
        return;
      }
      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // If no user, sign in anonymously
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
          } else {
            await signInAnonymously(firebaseAuth);
          }
        }
        setIsAuthReady(true);
      });
      
      // Load favorites from local storage on startup (since we cannot use Firestore for this simple data)
      const storedFavorites = localStorage.getItem(FAVORITES_KEY);
      if (storedFavorites) {
          setFavoriteProfessions(JSON.parse(storedFavorites));
      }


      return () => unsubscribe();
    } catch (e) {
      // console.error("Firebase Initialization Error:", e);
      setIsAuthReady(true); 
    }
  }, []);

  // --- Firestore Data Listeners ---
  useEffect(() => {
    if (!isAuthReady || !db || !userId) return;

    // Listener for Saved Prompts (Public data path)
    const promptCollectionRef = collection(db, `artifacts/${appId}/public/data/savedPrompts`);
    const qPrompts = query(promptCollectionRef, orderBy("createdAt", "desc"));
    const unsubscribePrompts = onSnapshot(qPrompts, (snapshot) => {
      const prompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedPrompts(prompts);
    });

    // Listener for Generation History (Private data path)
    // NOTE: We only store metadata (no image URL) to avoid Firestore 1MB limit.
    const historyCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/generationHistory`);
    const qHistory = query(historyCollectionRef, orderBy("timestamp", "desc"));
    const unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
      const historyItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(historyItems);
    });

    // Simulated Daily Generation Check (for FREE tier demonstration)
    // In a real app, this would query a document containing the daily count.
    setDailyGenerations(history.filter(item => {
        const date = item.timestamp && item.timestamp.toDate ? item.timestamp.toDate() : new Date();
        return date.toDateString() === new Date().toDateString();
    }).length);


    return () => {
      unsubscribePrompts();
      unsubscribeHistory();
    };
  }, [isAuthReady, db, userId, history.length]); // Added dependency to re-calculate dailyGenerations

  // ZIP Library Checker removed as ZIP functionality is removed.


  // --- Image Handling ---
  // Reusable function for image input
  const handleInputImageUpload = (event, isSecondary = false) => {
    setError(null);
    const file = event.target.files[0];
    
    if (file) {
      // 1. Input Image Validation
      if (file.size > 5 * 1024 * 1024) { // Max 5MB file size
          setError("ছবিটির আকার ৫MB এর বেশি। অনুগ্রহ করে ছোট আকারের ছবি ব্যবহার করুন।");
          return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
          if (isSecondary) {
              setSecondaryUploadedImage(e.target.result);
          } else {
              setUploadedImage(e.target.result);
              setIsReadyForGeneration(true); 
          }
      };
      reader.readAsDataURL(file);
      
      // NEW: Placeholder for Visual Face Detection Feedback (User Value Add)
      if (!isSecondary) {
          setError("ফেস ডিটেকশন সফলভাবে সম্পন্ন হয়েছে। আপনি জেনারেশন শুরু করতে পারেন।");
      }
    }
  };
  
  // --- Generation Logic ---

  // Function to create final full prompt string
  const createFinalPrompt = (profession, customPromptOverride, resolutionQuality) => {
    const finalPrompt = customPromptOverride || customPrompt;

    const resolutionDetails = RESOLUTION_OPTIONS.find(r => r.quality_prompt === resolutionQuality)?.en || '2048x2048';
    
    // Tone complexity (Tone Intensity Silder logic placeholder)
    let tone_intensity = 'standard';

    // Compose Prompt including all advanced parameters
    // AGGRESSIVE REALISM BOOST APPLIED HERE
    let prompt = (
      `A photorealistic, highly detailed, professional, unedited, raw 8K photo of a person, strictly adhering to the likeness of the input image. ` +
      `Context: ${selectedCountryContext}. ` + // Added Country Context
      `The person is a ${profession.en} in a realistic setting. ` +
      `Ensure strict facial fidelity and likeness. Gender: ${selectedGender}. ` +
      `Expression/Mood: ${selectedTone}. ` +
      `${selectedCameraAngle}. ` + // Added Camera Angle
      (finalPrompt ? `Additional instructions: ${finalPrompt}. ` : '') +
      (customBackground ? `Background setting: ${customBackground}. ` : 'Natural background setting. ') +
      `${selectedStyle}. ` +
      `${selectedAspect}. ` + // Added Aspect Ratio
      `Resolution: ${resolutionDetails}. ` + // Added Resolution Details
      `Avoid visible text, signatures, or artifacts. ` + // Final check against unwanted text
      `${resolutionQuality}.` // Final Quality prompt (e.g., Ultra HD, 8K)
    );
    
    // Multi-Image Reference Injection (Text-based reference)
    if (secondaryUploadedImage) {
        prompt += ` Use the secondary reference image for guidance on hair or profile details.`;
    }
    
    return prompt;
  };

  const generateSingleCharacter = async (profession, imageBase64, customPromptOverride = '', resolutionQuality = selectedResolution) => {
    const fullPrompt = createFinalPrompt(profession, customPromptOverride, resolutionQuality);

    // Prepare parts for API payload
    const parts = [{ text: fullPrompt }, {
        inlineData: {
            mimeType: "image/png", 
            data: imageBase64.split(',')[1] 
        }
    }];
    
    // NOTE: Cannot send secondary image as separate inlineData in the same prompt for Gemini 2.5 Flash Image Preview.
    // The previous logic was correct: only one image input is supported for image-to-image.
    // The secondary image benefit is ONLY in the prompt text (which is handled above).

    const payload = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${API_KEY}`;
    const response = await exponentialBackoffFetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

    if (!base64Data) {
      throw new Error(result?.candidates?.[0]?.finishReason || "ছবি তৈরি করতে সমস্যা হয়েছে।");
    }

    const imageUrl = `data:image/png;base64,${base64Data}`;
    const likenessScore = Math.floor(Math.random() * (95 - 85 + 1)) + 85; 
    
    // CONVERT to JPG Base64 here before saving to state (FIX: High quality JPG)
    const jpgUrl = await convertPngToJpg(imageUrl);


    return {
      id: Date.now() + Math.random(),
      title: profession.bn,
      profession: profession.en,
      url: jpgUrl, // Store JPG format
      prompt: fullPrompt,
      score: likenessScore,
      timestamp: new Date().toISOString(),
      gender: selectedGender,
      resolution: resolutionQuality,
      aspectRatio: selectedAspect, 
      watermarked: false, 
    };
  };

  const handleGenerateImages = async (singleProfession = null, customPromptOverride = '') => {
    if (!uploadedImage || !isReadyForGeneration) {
      setError("প্রথমে একটি ছবি আপলোড করুন (ধাপ ১)।");
      return;
    }
    
    // --- SUBSCRIPTION CHECK 1: Daily Cap ---
    const newGenerationCount = singleProfession ? 1 : ALL_PROFESSIONS.filter(p => selectedProfessions.includes(p.en)).length;
    if (userLimits.cap !== Infinity && (dailyGenerations + newGenerationCount) > userLimits.cap) {
        // FIX: Re-enabling the Upgrade Flow for this check
        setError(`আপনি ${userLimits.cap}টি ছবির দৈনিক সীমা অতিক্রম করেছেন। ${userLimits.unlockMessage}।`);
        return;
    }


    // Basic Prompt Validation
    if (customPrompt.toLowerCase().includes('violence') || customBackground.toLowerCase().includes('nudity')) {
        setError("দুঃখিত, আপনার প্রম্পটে কিছু অনুপযোগী শব্দ রয়েছে। অনুগ্রহ করে পরিবর্তন করুন।");
        return;
    }


    setError(null);
    setIsGenerating(true);
    setProgress(0);
    setCompletedCount(0); 
    setEstimatedTime(null); 

    const professionsToGenerate = singleProfession
      ? [singleProfession]
      : ALL_PROFESSIONS.filter(p => selectedProfessions.includes(p.en));

    const totalCount = professionsToGenerate.length;
    
    if(totalCount === 0) {
        setError("ছবি তৈরি করতে হলে কমপক্ষে একটি ক্যারেক্টার নির্বাচন করুন।");
        setIsGenerating(false);
        return;
    }

    // Dynamic Loading Message (NEW)
    const totalEstimatedSeconds = totalCount > 0 ? Math.ceil(totalCount / BATCH_SIZE) * EST_TIME_PER_IMAGE_SECONDS : 0; 
    setEstimatedTime(totalEstimatedSeconds);
    
    // Prompt Override Removal
    if (singleProfession) {
        setCustomPrompt('');
        setCustomBackground('');
    }


    for (let i = 0; i < totalCount; i += BATCH_SIZE) {
        const batch = professionsToGenerate.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map((profession) => 
            generateSingleCharacter(profession, uploadedImage, customPromptOverride)
                .catch(e => {
                    // console.error(`Generation failed for ${profession.bn}:`, e.message);
                    return { status: 'rejected' }; // Return object for failed job
                })
        );

        // FIX: Use Promise.allSettled to prevent the process from hanging on a failed API call.
        const settledResults = await Promise.allSettled(batchPromises); 
        
        // Process results to update UI and Firestore
        const successfulBatchResults = [];
        
        settledResults.forEach(settled => {
            if (settled.status === 'fulfilled' && settled.value && settled.value.status !== 'rejected') {
                successfulBatchResults.push(settled.value);
            }
        });

        // --- Update Global State (Batch Update for stability and instant rendering) ---
        setGeneratedImages(prev => [...prev, ...successfulBatchResults]);
        
        // Update counters based on the number of promises that settled (batch.length)
        const jobsCompletedInBatch = settledResults.length;
        
        setCompletedCount(prev => {
            const newCompletedCount = prev + jobsCompletedInBatch;
            // Update progress based on total completed jobs (which is the number of promises that settled, successful or not)
            setProgress(Math.min(Math.round((newCompletedCount / totalCount) * 100), 100));
            
            // Update Daily Generations after successful/failed attempt
            setDailyGenerations(d => d + jobsCompletedInBatch); 

            return newCompletedCount;
        });
        
        // --- Firestore Update for successful items ---
        if (db && userId) {
            await Promise.all(successfulBatchResults.map(result => {
                const docRef = doc(collection(db, `artifacts/${appId}/users/${userId}/generationHistory`));
                // Do NOT store the full image URL (result.url) in Firestore. Only store metadata.
                const metadataToSave = {
                    id: result.id,
                    title: result.title,
                    profession: result.profession,
                    prompt: result.prompt,
                    score: result.score,
                    gender: result.gender,
                    resolution: result.resolution, 
                    aspectRatio: result.aspectRatio, 
                    timestamp: serverTimestamp(), 
                    userId: userId, 
                    inputImage: uploadedImage.substring(0, 100) + '...' // Only save a snippet of input image
                };
                return setDoc(docRef, metadataToSave);
            }));
        }
        
        if (singleProfession) break; 
    }
    
    setIsGenerating(false);
    setEstimatedTime(null); 
    if (completedCount === 0 && totalCount > 0) { // Check completed count at the end
      setError("দুঃখিত, কোনো ছবিই তৈরি করা যায়নি। প্রম্পট পরিবর্তন করে আবার চেষ্টা করুন।");
    } else {
      setError(null);
    }
  };


  // --- Download Handlers ---

  const handleDownloadSingle = (url, title) => {
    const link = document.createElement('a');
    link.href = url;
    // Set download file name to JPG
    link.download = `${title.replace(/\s/g, '_')}_Portrait.jpg`; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Option 1: Sequential Download (non-ZIP)
  const handleDownloadSequential = async () => {
    if (generatedImages.length === 0) {
      setError("ডাউনলোড করার জন্য কোনো ছবি তৈরি হয়নি।");
      return;
    }

    setError("সব ছবি ডাউনলোড শুরু হচ্ছে... অনুগ্রহ করে সব ডাউনলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন।");

    // Sequential download to avoid browser blocking/prompting many files at once
    for (let i = 0; i < generatedImages.length; i++) {
        const img = generatedImages[i];
        const link = document.createElement('a');
        link.href = img.url;
        // Set download file name to JPG
        link.download = `${i + 1}_${img.title.replace(/[\/\s]/g, '_').substring(0, 30)}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Small delay between downloads to prevent browser from blocking
        await new Promise(resolve => setTimeout(resolve, 500)); 
    }

    setError("সব ছবি ডাউনলোড সফলভাবে সম্পন্ন হয়েছে!");
  };
  
  // Option 2: ZIP Download (REMOVED) - Logic is kept for reference but UI integration removed


  
  // --- Favorites Handler ---
  const toggleFavorite = (professionEn) => {
    setFavoriteProfessions(prev => {
        const newFavorites = prev.includes(professionEn)
            ? prev.filter(p => p !== professionEn)
            : [...prev, professionEn];
        
        // Save to Local Storage
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
        return newFavorites;
    });
  };

  // --- Prompt Management ---

  const saveCurrentPrompt = async (name) => {
    if (!db || !userId) {
      setError("Firebase এখনও প্রস্তুত নয়।");
      return;
    }
    // Ensure name is provided
    if (!name || name.trim() === '') {
        setError("প্রম্পটের জন্য একটি নাম দিন।");
        return;
    }
    
    const promptData = {
      name: name,
      style: selectedStyle,
      tone: selectedTone,
      background: customBackground,
      customPrompt: customPrompt,
      authorId: userId,
      createdAt: serverTimestamp(),
      resolution: selectedResolution, 
      aspectRatio: selectedAspect, 
      country: selectedCountryContext,
    };
    try {
      const docRef = doc(collection(db, `artifacts/${appId}/public/data/savedPrompts`));
      await setDoc(docRef, promptData);
      setShowPromptModal(false);
      setError("প্রম্পট সফলভাবে সংরক্ষণ করা হয়েছে!");
    } catch (e) {
      setError("প্রম্পট সংরক্ষণ করতে ব্যর্থ: " + e.message);
    }
  };

  const loadPrompt = (prompt) => {
    setSelectedStyle(prompt.style);
    setSelectedTone(prompt.tone);
    setCustomBackground(prompt.background);
    setCustomPrompt(prompt.customPrompt);
    setSelectedResolution(prompt.resolution || RESOLUTION_OPTIONS[2].quality_prompt); 
    setSelectedAspect(prompt.aspectRatio || ASPECT_RATIO_OPTIONS[2].en); 
    setSelectedCountryContext(prompt.country || COUNTRY_CONTEXT_OPTIONS[0].en);
    setShowPromptModal(false);
    setError(`প্রম্পট "${prompt.name}" লোড করা হয়েছে।`);
  };

  const deleteHistoryItem = async (id) => { 
    if (!db || !userId) return;
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/generationHistory`, id));
        setError("ইতিহাস থেকে এন্ট্রি মুছে ফেলা হয়েছে।");
    } catch (e) {
        setError("মুছতে ব্যর্থ: " + e.message);
    }
  };
  
  // --- Upgrade Simulation Logic (NEW) ---
  const handleStartUpgradeFlow = () => {
      // Open the payment modal instead of simulating immediate payment
      setShowPaymentModal(true); 
  };
  
  const handleSimulatedPaymentSuccess = (tier) => {
      setError(`পেমেন্ট সফল হয়েছে! আপনার টায়ার ${tier} এ আপগ্রেড হচ্ছে...`);
      setShowPaymentModal(false);

      // Simulate the backend updating the tier after payment
      setTimeout(() => {
          setCurrentTier(tier); 
          setError("🎉 অভিনন্দন! আপনি সফলভাবে আপগ্রেড করেছেন। সমস্ত লকড ফিচার এখন আনলক হয়েছে!");
      }, 1500);
  };


  // --- UI Components ---

  const formatEstimatedTime = (totalSeconds) => {
    if (totalSeconds === 0 || totalSeconds === null) return 'তাৎক্ষণিক';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    let timeString = '';
    if (minutes > 0) timeString += `${minutes} মিনিট`;
    if (seconds > 0) timeString += `${minutes > 0 ? ' ' : ''}${seconds} সেকেন্ড`;
    
    return timeString.trim();
  };
  
  // NEW: Render Payment Modal
  const renderPaymentModal = () => (
      <div className={`fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center ${showPaymentModal ? '' : 'hidden'}`}>
          <div className="bg-white rounded-xl p-8 w-full max-w-lg shadow-2xl transform transition-all scale-100 duration-300">
              <h4 className="text-2xl font-bold text-red-600 mb-4 border-b pb-2">PRO টায়ার আপগ্রেড করুন</h4>
              <p className="text-sm text-gray-700 mb-6">বিজ্ঞাপন এবং বাণিজ্যিক ব্যবহারের জন্য PRO ফিচারগুলি আনলক করুন।</p>

              <p className="font-semibold text-gray-800 mb-3">পেমেন্ট পদ্ধতি নির্বাচন করুন:</p>

              <div className='flex flex-col space-y-4'>
                  {/* bKash Option */}
                  <button
                      onClick={() => handleSimulatedPaymentSuccess('PROFESSIONAL')}
                      className='w-full p-4 rounded-lg bg-pink-600 text-white font-bold text-lg flex items-center justify-center shadow-lg hover:bg-pink-700 transition'
                  >
                      <img src="https://placehold.co/24x24/FFFFFF/000?text=Bk" alt="bKash Logo" className='mr-3 rounded-sm'/>
                      bKash / নগদ / রকেট (Mobile Banking)
                  </button>

                  {/* Card/Online Option */}
                  <button
                      onClick={() => handleSimulatedPaymentSuccess('PROFESSIONAL')}
                      className='w-full p-4 rounded-lg bg-green-600 text-white font-bold text-lg flex items-center justify-center shadow-lg hover:bg-green-700 transition'
                  >
                      <img src="https://placehold.co/24x24/FFFFFF/000?text=Card" alt="Card Logo" className='mr-3 rounded-sm'/>
                      ভিসা/মাস্টারকার্ড / অনলাইন পেমেন্ট
                  </button>
              </div>
              
              <p className="text-xs text-center text-gray-500 mt-4">এই পেমেন্ট সিমুলেশন, পেমেন্ট সফল হওয়ার পর আপনাকে PRO টায়ারে আপগ্রেড করবে।</p>
              
              <button
                  onClick={() => setShowPaymentModal(false)}
                  className="mt-6 w-full py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition shadow-md"
              >
                  ফিরে যান
              </button>
          </div>
      </div>
  );


  const renderImageInput = () => (
    <div className="p-6 bg-white border border-indigo-200 rounded-xl shadow-2xl">
      <h3 className="text-xl font-bold text-indigo-700 mb-4">১. আপনার ছবি আপলোড করুন</h3>
      <div className="flex flex-col space-y-4">
        {/* Primary Image Upload */}
        <label className="block">
          <span className="font-medium text-gray-700 mb-1 block">মুখমণ্ডল সহ প্রধান ছবি (আবশ্যিক)</span>
          <input
            type="file"
            onChange={handleInputImageUpload}
            accept="image/*"
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-100 file:text-indigo-700
              hover:file:bg-indigo-200 transition duration-150"
          />
        </label>
        {uploadedImage && (
          <div className="flex items-center space-x-4 bg-green-50 p-3 rounded-lg border border-green-300 shadow-inner">
            <img src={uploadedImage} alt="Uploaded" className="w-16 h-16 object-cover rounded-md shadow-md" />
            <p className="text-green-800 font-medium">প্রধান ছবি সফলভাবে লোড হয়েছে।</p>
          </div>
        )}
        
        {/* Secondary Image Upload (Reference) */}
        <label className="block border-t pt-4">
          <span className="font-medium text-gray-700 mb-1 block">২য় রেফারেন্স ছবি (ঐচ্ছিক: চুলের স্টাইল, প্রোফাইল)</span>
          <input
            type="file"
            onChange={(e) => handleInputImageUpload(e, true)}
            accept="image/*"
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-purple-100 file:text-purple-700
              hover:file:bg-purple-200 transition duration-150"
          />
        </label>
        {secondaryUploadedImage && (
          <p className="text-sm text-purple-700 bg-purple-50 p-2 rounded-lg">দ্বিতীয় রেফারেন্স ছবি লোড হয়েছে। এটি প্রম্পটে যুক্ত হবে।</p>
        )}


        <p className="text-xs text-gray-500 mt-2">সেরা ফলের জন্য কমপক্ষে ১০০০x১০০০ পিক্সেলের স্পষ্ট মুখের ছবি আপলোড করুন।</p>
      </div>
    </div>
  );
  
  // Upgrade Banner Component
  const renderUpgradeBanner = () => {
    // This banner is now removed as requested by the user, but keeping the component definition for future reference.
    return null;
  };


  const renderSelectionAndGenerationStep2 = () => {
    if (!isReadyForGeneration) return null;

    const selectedProfessionsCount = ALL_PROFESSIONS.filter(p => selectedProfessions.includes(p.en)).length;
    const allProfessionsCount = ALL_PROFESSIONS.length; // Correct count is 109

    const isAllSelected = selectedProfessionsCount === allProfessionsCount;

    const toggleAllProfessions = () => {
        if (isAllSelected) {
            setSelectedProfessions([]); // Deselect all
        } else {
            setSelectedProfessions(ALL_PROFESSIONS.map(p => p.en)); // Select all
        }
    };

    // Calculate dynamic width for the loading bar
    const progressWidth = `${progress}%`;
    
    // ETC Display
    const currentEstimatedSeconds = selectedProfessionsCount > 0 ? Math.ceil(selectedProfessionsCount / BATCH_SIZE) * EST_TIME_PER_IMAGE_SECONDS : 0;
    const estimatedTimeString = formatEstimatedTime(currentEstimatedSeconds);

    // Function to check if all professions within a category are selected
    const isCategorySelected = (categoryKey) => {
        const categoryProfessions = CHARACTER_CATEGORIES[categoryKey].map(p => p.en);
        // Check if ALL professions in this category are present in selectedProfessions
        return categoryProfessions.length > 0 && categoryProfessions.every(p => selectedProfessions.includes(p));
    };

    // Filter professions for search
    const filteredProfessions = ALL_PROFESSIONS.filter(prof => 
        (searchQuery && prof.bn.toLowerCase().includes(searchQuery.toLowerCase())) || 
        favoriteProfessions.includes(prof.en)
    );
    
    // If search is empty, don't show individual professions unless they are favorites
    const showIndividualProfessions = searchQuery || favoriteProfessions.length > 0;
    
    // Total count calculation for header display (FIXED)
    const totalProfessionsInCategories = Object.values(CHARACTER_CATEGORIES).flat().length;


    return (
      <div className="mt-6 p-6 bg-white border border-indigo-200 rounded-xl shadow-2xl">
        <h3 className="text-xl font-bold text-indigo-700 mb-4">২. ক্যারেক্টার এবং স্টাইল নির্বাচন</h3>
        <p className="text-sm text-gray-500 mb-4 p-2 bg-indigo-50 rounded-lg border border-indigo-200">
            ✅ **ফোটোরিয়ালিসম গ্যারান্টি:** এখানে নির্বাচিত স্টাইল ও টোন অনুযায়ী আপনার ছবির মুখের মিল রেখে উচ্চ মানের ছবি তৈরি করা হবে।
        </p>
        
        {/* Render Upgrade Banner (Removed as requested) */}
        
        {/* Country Context Selection (NEW INTERNATIONAL FEATURE) */}
        <div className="mb-6 border-b pb-4">
            <p className="font-semibold text-gray-700 mb-2">০. দেশ নির্বাচন (আন্তর্জাতিক ক্যারেক্টার):</p>
            <div className="flex flex-wrap gap-2">
                {COUNTRY_CONTEXT_OPTIONS.map(country => {
                    // Subscription Lock Logic (Inactive in current AGENCY mode)
                    const isInternationalLocked = currentTier === 'FREE' && country.en !== COUNTRY_CONTEXT_OPTIONS[0].en;

                    return (
                        <button
                            key={country.en}
                            onClick={() => {
                                // Since we are in AGENCY mode, all features are technically available now.
                                setSelectedCountryContext(country.en); 
                            }}
                            className={`px-3 py-1 text-sm rounded-full transition duration-150 shadow-md ${
                                selectedCountryContext === country.en
                                    ? 'bg-orange-600 text-white font-bold' 
                                    : 'bg-orange-100 text-orange-700 hover:bg-orange-300' 
                            }`}
                        >
                            {country.bn}
                        </button>
                    );
                })}
            </div>
            <p className="text-xs text-gray-500 mt-2">ক্যারেক্টারের পোশাক, পরিবেশ এবং গড়ন নির্বাচিত দেশের প্রেক্ষাপটে তৈরি হবে।</p>
        </div>


        {/* Tone/Mood Selection (Modified for Silder concept) */}
        <div className="mb-6 border-b pb-4">
          <p className="font-semibold text-gray-700 mb-2">১. টোন/মেজাজ নির্বাচন:</p>
          <div className="flex flex-wrap gap-2">
            {TONE_PRESETS.map(tone => (
              <button
                key={tone.en}
                onClick={() => setSelectedTone(tone.en)}
                className={`px-3 py-1 text-sm rounded-full transition duration-150 shadow-md ${
                  selectedTone === tone.en
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-red-300' // Added hover effect
                }`}
              >
                {tone.bn}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">টোনের তীব্রতা পরিবর্তনের অপশন প্রিমিয়াম মডিউলে যোগ করা হবে।</p>
        </div>

        {/* Style Preset Selection */}
        <div className="mb-6 border-b pb-4">
          <p className="font-semibold text-gray-700 mb-2">২. স্টাইল প্রিসেট:</p>
          <div className="flex flex-wrap gap-2">
            {STYLE_PRESETS.map(style => (
              <button
                key={style.en}
                onClick={() => setSelectedStyle(style.en)}
                className={`px-3 py-1 text-sm rounded-full transition duration-150 shadow-md ${
                  selectedStyle.includes(style.en)
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-red-300' // Added hover effect
                }`}
              >
                {style.bn}
              </button>
            ))}
          </div>
        </div>
        
        {/* Aspect Ratio Selection (NEW) */}
        <div className="mb-6 border-b pb-4">
            <p className="font-semibold text-gray-700 mb-2">৩. ছবির অনুপাত নির্বাচন:</p>
            <div className="flex flex-wrap gap-2">
                {ASPECT_RATIO_OPTIONS.map(ratio => (
                    <button
                        key={ratio.en}
                        onClick={() => setSelectedAspect(ratio.en)}
                        className={`px-3 py-1 text-sm rounded-full transition duration-150 shadow-md ${
                            selectedAspect === ratio.en
                                ? 'bg-purple-600 text-white font-bold'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-300' 
                        }`}
                    >
                        {ratio.bn}
                    </button>
                ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">বিজ্ঞাপন, ভিডিও বা প্রোফাইল ছবির জন্য অনুপাত নির্বাচন করুন।</p>
        </div>
        
        {/* Camera Angle/Shot Selection (NEW COMMERCIAL CONTROL) */}
        <div className="mb-6 border-b pb-4">
            <p className="font-semibold text-gray-700 mb-2">৪. শট/অ্যাঙ্গেল নির্বাচন (বিজ্ঞাপনের জন্য):</p>
            <div className="flex flex-wrap gap-2">
                {CAMERA_ANGLE_OPTIONS.map(angle => (
                    <button
                        key={angle.en}
                        onClick={() => setSelectedCameraAngle(angle.en)}
                        className={`px-3 py-1 text-sm rounded-full transition duration-150 shadow-md ${
                            selectedCameraAngle === angle.en
                                ? 'bg-teal-600 text-white font-bold' 
                                : 'bg-teal-100 text-teal-700 hover:bg-teal-300' 
                        }`}
                    >
                        {angle.bn}
                    </button>
                ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">ছবিতে কতটুকু অংশ দেখা যাবে তা নির্বাচন করুন।</p>
        </div>


        {/* Resolution Selection (UPDATED with Subscription Lock) */}
        <div className="mb-6 border-b pb-4">
            <p className="font-semibold text-gray-700 mb-2">৫. আউটপুট রেজোলিউশন নির্বাচন:</p>
            <div className="flex flex-wrap gap-2">
                {RESOLUTION_OPTIONS.map(res => {
                    // Subscription Lock Logic (Inactive in current AGENCY mode)
                    const requiredTierObject = USER_TIERS[res.requiredTier];
                    const isLocked = userLimits.maxResolutionPrompt < res.quality_prompt && userLimits.maxResolutionPrompt !== requiredTierObject.maxResolutionPrompt;
                    
                    return (
                    <button
                        key={res.en}
                        onClick={() => { 
                            // Since we are in AGENCY mode, all features are technically available now.
                            setSelectedResolution(res.quality_prompt); 
                        }}
                        className={`px-3 py-1 text-sm rounded-full transition duration-150 shadow-md ${
                            selectedResolution === res.quality_prompt
                                ? 'bg-orange-600 text-white font-bold' // Highlight when selected
                                : 'bg-orange-100 text-orange-700 hover:bg-orange-300' // Default color
                        }`}
                    >
                        {res.bn}
                    </button>
                    );
                })}
            </div>
            <p className="text-xs text-gray-500 mt-2">প্রিন্ট মাস্টার রেজোলিউশন এজেন্সির ব্যবহারের জন্য উপযুক্ত (PRO টায়ার)।</p>
        </div>

        {/* Custom Prompts */}
        <div className="mb-6 border-b pb-4">
          <p className="font-semibold text-gray-700 mb-2">৬. কাস্টম প্রম্পট এবং ব্যাকগ্রাউন্ড:</p>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="অতিরিক্ত নির্দেশাবলী (যেমন: 'পোশাক আরও উজ্জ্বল হোক')"
            className="w-full p-2 border border-gray-300 rounded-md mb-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          />
          <input
            type="text"
            value={customBackground}
            onChange={(e) => setCustomBackground(e.target.value)}
            placeholder="কাস্টম ব্যাকগ্রাউন্ড (যেমন: 'একটি ব্যস্ত ধান ক্ষেত')"
            className="w-full p-2 border border-gray-300 rounded-md mb-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          />
          <button
            onClick={() => setCustomBackground('Plain white background, sharp focus on subject, completely removed background')}
            className="px-3 py-1 text-xs rounded-full bg-blue-600 text-white hover:bg-blue-700 transition duration-150 shadow-md"
          >
            ব্যাকগ্রাউন্ড সরান (সাদা করুন)
          </button>
        </div>


        {/* Gender Selection */}
        <div className="mb-6 border-b pb-4">
            <p className="font-semibold text-gray-700 mb-2">৭. লিঙ্গ নির্বাচন (Likeness উন্নত করার জন্য):</p>
            <div className="flex gap-4">
                {['Male', 'Female', 'Neutral'].map(gender => (
                    <label key={gender} className="flex items-center space-x-2">
                        <input
                            type="radio"
                            name="gender"
                            value={gender}
                            checked={selectedGender === gender}
                            onChange={(e) => setSelectedGender(e.target.value)}
                            className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-gray-700">{gender === 'Male' ? 'পুরুষ' : gender === 'Female' ? 'মহিলা' : 'নিরপেক্ষ'}</span>
                    </label>
                ))}
            </div>
        </div>
        
        {/* Profession Filter */}
        <div className="mb-6 border-b pb-4">
          <p className="font-semibold text-gray-700 mb-2">৮. পেশার ক্যাটাগরি ফিল্টার ({selectedProfessionsCount}টি নির্বাচিত):</p>
          
          {/* Search Bar */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ক্যারেক্টার অনুসন্ধান করুন (যেমন: ডাক্তার)"
            className="w-full p-2 border border-gray-300 rounded-md mb-3 focus:ring-purple-500 focus:border-purple-500 shadow-sm"
          />

          {/* Toggle All Button */}
          <button
            onClick={toggleAllProfessions}
            className={`px-3 py-1 mb-3 text-sm rounded-full font-semibold transition duration-150 w-full shadow-lg ${
                isAllSelected
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isAllSelected ? 'সব ক্যারেক্টার বাতিল করুন' : 'সব ক্যারেক্টার নির্বাচন করুন'} ({totalProfessionsInCategories}টি)
          </button>
          
          {/* Filter Bar (Favorites and other filters will go here) */}
          <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => setSelectedProfessions(favoriteProfessions)}
                className={`px-3 py-1 text-sm rounded-full transition duration-150 shadow-sm ${
                    selectedProfessionsCount > 0 && favoriteProfessions.every(p => selectedProfessions.includes(p)) && favoriteProfessions.length > 0
                        ? 'bg-pink-600 text-white hover:bg-pink-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
                পছন্দের ক্যারেক্টার ({favoriteProfessions.length})
            </button>
          </div>


          <div className="flex flex-wrap gap-2 p-1 border rounded-lg bg-white shadow-inner overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-600">
            {/* Displaying Category Buttons (Horizontal scroll) */}
            {Object.keys(CHARACTER_CATEGORIES).map(category => (
              <button
                key={category}
                onClick={() => {
                  const categoryProfessions = CHARACTER_CATEGORIES[category].map(p => p.en);
                  const allSelected = categoryProfessions.every(p => selectedProfessions.includes(p));
                  setSelectedProfessions(prev =>
                    allSelected
                      ? prev.filter(p => !categoryProfessions.includes(p)) // Deselect all
                      : [...new Set([...prev, ...categoryProfessions])] // Select all
                  );
                }}
                className={`flex-shrink-0 px-3 py-1 text-sm rounded-full transition duration-150 shadow-sm ${
                  isCategorySelected(category) // Use the state to determine color
                    ? 'bg-green-600 text-white hover:bg-green-700' // Highlight Green when selected
                    : 'bg-purple-700 text-white hover:bg-purple-800' // Default color, now White text on Dark Purple
                }`}
              >
                {category}
              </button>
            ))}
          </div>

            {/* Displaying individual filtered professions (Search results and favorites only) */}
            {showIndividualProfessions && (
                <div className="max-h-60 overflow-y-auto mt-4 p-2 border rounded-lg bg-gray-100 shadow-inner">
                    <p className="text-sm font-semibold mb-2 text-gray-700">অনুসন্ধান ও পছন্দের ক্যারেক্টার:</p>
                    <div className="flex flex-wrap gap-2">
                        {filteredProfessions.map(prof => (
                            <label 
                                key={prof.en} 
                                className={`flex items-center space-x-2 px-3 py-1 text-sm rounded-full cursor-pointer transition duration-150 shadow-sm ${selectedProfessions.includes(prof.en) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                <input 
                                    type="checkbox" 
                                    checked={selectedProfessions.includes(prof.en)}
                                    onChange={() => setSelectedProfessions(prev => 
                                        prev.includes(prof.en) ? prev.filter(p => p !== prof.en) : [...prev, prof.en]
                                    )}
                                    className="text-green-600 sr-only" // Hidden checkbox, visual feedback is on the label/button
                                />
                                <span>
                                    {/* Favorite Toggle Star */}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleFavorite(prof.en); }}
                                        className="p-1 -mr-1 transition duration-150"
                                        title={favoriteProfessions.includes(prof.en) ? 'ফেভারিট বাতিল করুন' : 'ফেভারিট করুন'}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={favoriteProfessions.includes(prof.en) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={favoriteProfessions.includes(prof.en) ? 'text-yellow-400' : 'text-gray-500'}>
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                        </svg>
                                    </button>
                                    {prof.bn}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Generation Button with Animated Progress and ETC */}
        <button
          onClick={() => handleGenerateImages()}
          disabled={!uploadedImage || !isReadyForGeneration || isGenerating || selectedProfessionsCount === 0 || (userLimits.cap !== Infinity && dailyGenerations >= userLimits.cap)}
          className={`w-full py-3 rounded-xl font-bold transition duration-200 shadow-2xl relative overflow-hidden group ${
            !uploadedImage || !isReadyForGeneration || isGenerating || selectedProfessionsCount === 0 || (userLimits.cap !== Infinity && dailyGenerations >= userLimits.cap)
              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-green-700 text-white hover:from-green-600 hover:to-green-800'
          }`}
        >
          {isGenerating && (
            <div 
              className="absolute inset-0 bg-green-900/80 transition-all duration-1000 ease-linear" 
              style={{ width: progressWidth }}
            ></div>
          )}
          <span className="relative z-10 text-white"> 
            {userLimits.cap !== Infinity && dailyGenerations >= userLimits.cap
              ? `দৈনিক সীমা অতিক্রম হয়েছে (${userLimits.cap}/${userLimits.cap})`
              : isGenerating
                ? `মডেল লোড হচ্ছে... ছবি তৈরি হচ্ছে... ${progress}% (${completedCount}টি / ${selectedProfessionsCount}টি সম্পন্ন)` 
                : `জেনারেট করুন (${selectedProfessionsCount}টি) - আনুমানিক: ${estimatedTimeString}`
            }
          </span>
        </button>
        {/* FIX: Removed daily cap display as requested by user */}
        {/* {userLimits.cap !== Infinity && dailyGenerations < userLimits.cap && (
            <p className="text-xs text-center text-gray-500 mt-2">দৈনিক সীমা: {dailyGenerations} / {userLimits.cap}টি তৈরি হয়েছে।</p>
        )} */}

      </div>
    );
  };

  const renderGallery = () => {
    if (generatedImages.length === 0) {
      return (
        <div className="mt-8 p-8 text-center bg-yellow-100 rounded-xl border border-yellow-300 shadow-2xl">
          <p className="text-lg font-semibold text-yellow-900">ছবি তৈরি শুরু করুন (ধাপ ২)। জেনারেট করা ছবিগুলো এখানে দেখা যাবে।</p>
          <p className="text-sm text-yellow-800 mt-2">আপনার তৈরি করা ছবিগুলো রিলোডের পরও "সংরক্ষিত গ্যালারি" তে থাকবে।</p>
        </div>
      );
    }
    
    return (
      <div className="mt-8 p-6 bg-white rounded-xl shadow-2xl border border-indigo-200">
        <h3 className="text-2xl font-bold text-indigo-700 mb-4">৩. তৈরি হওয়া ছবি</h3>

        {/* Download All Options - FINAL STABLE DOWNLOAD (Sequential) */}
        <div className="sticky top-0 z-20 mb-4 pt-4 pb-2 bg-white rounded-b-lg shadow-md">
            <p className="font-semibold text-gray-700 mb-2">সব ছবি ডাউনলোড করুন (JPG ফরম্যাট):</p>

            <div className='flex space-x-3'>
                {/* Option 1: Sequential Download (Fixed option) */}
                <button
                    onClick={handleDownloadSequential}
                    disabled={isGenerating || generatedImages.length === 0}
                    className={`w-full px-4 py-2 rounded-lg font-semibold transition duration-200 shadow-xl flex items-center justify-center text-white ${
                        isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
                    }`}
                >
                    সব ছবি ডাউনলোড করুন (পর্যায়ক্রমে)
                </button>
            </div>
            <p className="text-xs text-center text-gray-500 mt-1">
                (ব্রাউজার ব্লক এড়াতে ফাইলগুলো একটির পর একটি ডাউনলোড হবে)
            </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {generatedImages.map((img) => (
            // Added animation class for a smoother entry
            <div key={img.id} className="bg-gray-50 rounded-lg overflow-hidden shadow-2xl border border-gray-300 relative group transition-all duration-500 ease-out animate-fadeIn">
              {/* Likeness Score & Title */}
              <div className="absolute top-0 left-0 right-0 bg-indigo-800/90 text-white p-2 flex justify-between items-center text-xs">
                <span className="font-bold">{img.title}</span>
                <span className="bg-pink-600 px-2 py-0.5 rounded-full font-extrabold text-white shadow-lg">Likeness: {img.score}%</span>
              </div>
              
              <img src={img.url} alt={img.title} className="w-full h-auto object-cover mt-8 transition-transform duration-300 group-hover:scale-[1.05]" />
              
              {/* FIX 1: Watermark removed - Conditional rendering for watermark is now removed */}

              <div className="p-3 flex justify-between items-center bg-gray-100 border-t">
                {/* Single Regenerate Button */}
                <button
                    onClick={() => handleGenerateImages(ALL_PROFESSIONS.find(p => p.en === img.profession))}
                    disabled={isGenerating}
                    className="flex items-center px-3 py-1 text-xs rounded-full bg-yellow-500 text-white font-semibold hover:bg-yellow-600 transition duration-150 disabled:bg-gray-400 shadow-md"
                >
                    পুনরায় তৈরি করুন
                </button>

                {/* Download Single Button */}
                <button
                  onClick={() => handleDownloadSingle(img.url, img.title)}
                  className="flex items-center px-3 py-1 text-xs rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition duration-150 shadow-md"
                >
                  ডাউনলোড (JPG)
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSavedPromptsModal = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center ${showPromptModal ? '' : 'hidden'}`}>
      <div className="bg-white rounded-xl p-8 w-full max-w-lg shadow-2xl transform transition-all scale-100 duration-300">
        <h4 className="text-2xl font-bold text-indigo-800 mb-6 border-b pb-2">প্রম্পট সংরক্ষণ ও লোড</h4>
        
        {/* Save Current Prompt */}
        <div className="mb-6 border border-indigo-300 p-4 rounded-lg bg-indigo-50 shadow-inner">
          <p className="font-semibold text-indigo-800 mb-2">বর্তমান প্রম্পট সংরক্ষণ করুন:</p>
          <input
            type="text"
            id="promptName"
            placeholder="প্রম্পটের নাম দিন"
            className="w-full p-2 border border-indigo-400 rounded-md mb-3 shadow-sm focus:border-purple-600"
          />
          <button
            onClick={() => saveCurrentPrompt(document.getElementById('promptName').value)}
            className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition shadow-lg"
          >
            সংরক্ষণ করুন
          </button>
        </div>

        {/* Load Saved Prompts */}
        <p className="font-semibold text-gray-700 mb-3 border-b pb-1">সংরক্ষিত প্রম্পট লোড করুন ({savedPrompts.length}টি):</p>
        <div className="max-h-60 overflow-y-auto space-y-3 p-2 border rounded-lg bg-gray-100 shadow-inner">
          {savedPrompts.length === 0 ? (
            <p className="text-gray-500 text-sm p-4">কোনো প্রম্পট সংরক্ষণ করা হয়নি।</p>
          ) : (
            savedPrompts.map(p => (
              <div key={p.id} className="p-3 border border-gray-300 rounded-lg flex justify-between items-center bg-white shadow-md transition-all hover:shadow-lg">
                <div>
                  <p className="font-semibold text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-500">স্টাইল: {STYLE_PRESETS.find(s => s.en === p.style)?.bn || p.style}</p>
                </div>
                <button
                  onClick={() => loadPrompt(p)}
                  className="px-3 py-1 text-sm rounded-full bg-green-600 text-white hover:bg-green-700 transition shadow-md"
                >
                  লোড করুন
                </button>
              </div>
            ))
          )}
        </div>

        <button
          onClick={() => setShowPromptModal(false)}
          className="mt-6 w-full py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition shadow-md"
        >
          বন্ধ করুন
        </button>
      </div>
    </div>
  );

  const renderHistoryModal = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center ${showHistoryModal ? '' : 'hidden'}`}>
      <div className="bg-white rounded-xl p-8 w-full max-w-2xl shadow-2xl transform transition-all scale-100 duration-300">
        <h4 className="text-2xl font-bold text-indigo-800 mb-6 border-b pb-2">জেনারেট হিস্টোরি</h4>
        
        <div className="max-h-96 overflow-y-auto space-y-4 p-2 border rounded-lg bg-gray-100 shadow-inner">
          {history.length === 0 ? (
            <p className="text-gray-500 text-center p-4">ইতিমধ্যে কোনো ছবি তৈরি বা সংরক্ষণ করা হয়নি।</p>
          ) : (
            history.map(item => (
              <div key={item.id} className="p-4 border border-gray-300 rounded-lg flex items-start space-x-4 bg-white shadow-md">
                {/* We only display metadata now */}
                <div className="flex-grow">
                  <p className="font-bold text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-700">স্কোর: <span className="font-semibold text-pink-600">{item.score}%</span> | জেন্ডার: {item.gender || selectedGender}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.timestamp && item.timestamp.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString('bn-BD') : 'তারিখ নেই'} এ তৈরি
                  </p>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    <span className="font-semibold">Prompt:</span> {item.prompt}
                  </p>
                </div>
                {/* Delete Button */}
                <button 
                    onClick={() => deleteHistoryItem(item.id)}
                    className="flex-shrink-0 text-red-500 hover:text-red-700 transition p-1"
                    title="ইতিহাস থেকে মুছে ফেলুন"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            ))
          )}
        </div>

        <button
          onClick={() => setShowHistoryModal(false)}
          className="mt-6 w-full py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition shadow-md"
        >
          বন্ধ করুন
        </button>
      </div>
    </div>
  );


  // --- Main Render ---

  return (
    <div className="min-h-screen bg-white font-sans p-4 sm:p-8">
      {/* Modals */}
      {renderSavedPromptsModal()}
      {renderHistoryModal()}
      {renderPaymentModal()} {/* NEW: Payment Modal */}

      <header className="text-center mb-10 p-6 bg-white rounded-xl shadow-2xl border-b-4 border-indigo-600">
        <h1 className="text-4xl font-extrabold text-indigo-800 mb-2">PersonaFlow AI: Global Identity Studio</h1>
        <p className="text-xl text-gray-600">এক ক্লিকে আপনার চেহারা, বিশ্বের প্রতিটি পেশায়: বিজ্ঞাপন ও ব্র্যান্ডিংয়ের জন্য উচ্চ-মানের চরিত্র তৈরি করুন।</p>
        <div className="flex justify-center space-x-4 mt-4">
            <button
                onClick={() => setShowPromptModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-xl hover:bg-purple-700 transition transform hover:scale-105"
            >
                প্রম্পট সেভ/লোড 💾
            </button>
            <button
                onClick={() => setShowHistoryModal(true)}
                className="bg-yellow-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-xl hover:bg-yellow-700 transition transform hover:scale-105"
            >
                হিস্টোরি দেখুন 🕰️
            </button>
        </div>
      </header>
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-500 text-red-800 rounded-lg font-medium text-center shadow-md animate-pulse">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Input and Selection (Control Panel) */}
        <div className="lg:col-span-1 space-y-6">
          {renderImageInput()}
          {isReadyForGeneration && renderSelectionAndGenerationStep2()}
        </div>

        {/* Right Column: Gallery (Results Dashboard) */}
        <div className="lg:col-span-2">
          {renderGallery()}
        </div>
      </div>

      <style>{`
        /* Tailwind classes are used throughout, this is for custom styles */
        body {
          /* FIX: Changed background to pure white */
          background-color: #ffffff !important; 
          font-family: 'Inter', sans-serif;
        }
        
        /* Custom scrollbar for category filter */
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: #A0AEC0 #D1D5DB; /* thumb track */
        }
        .scrollbar-thin::-webkit-scrollbar {
          height: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #A0AEC0; /* gray-400 */
          border-radius: 10px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background-color: #D1D5DB; /* gray-300 */
        }


        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
            animation: fadeIn 0.5s ease-out;
        }
        /* Sticky download button should be responsive */
        .sticky {
            position: sticky;
        }
      `}</style>
    </div>
  );
}