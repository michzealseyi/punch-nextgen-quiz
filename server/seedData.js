// Seed content. Quizzes mirror PUNCH desks: News, Sports, Business, HealthWise, Metro Plus.
// Each quiz has a bank of 12 questions; every attempt draws 10 of them in random order.
module.exports.quizzes = [
  {
    slug: 'nigeria-in-focus', title: 'Nigeria in focus', category: 'News',
    description: 'Government, institutions and the stories shaping the country.',
    seconds_per_question: 20, points_per_correct: 10, questions_per_attempt: 10, questions: [
      ['What is the capital city of Nigeria?', ['Lagos', 'Abuja', 'Ibadan', 'Kano'], 1, 'Abuja replaced Lagos as the capital in December 1991.'],
      ['How many states make up the Federation of Nigeria?', ['30', '34', '36', '37'], 2, 'Nigeria has 36 states plus the Federal Capital Territory.'],
      ['Which body conducts general elections in Nigeria?', ['NPC', 'INEC', 'NBS', 'NCC'], 1, 'The Independent National Electoral Commission organises federal and state elections.'],
      ['In what year did Nigeria gain independence?', ['1957', '1960', '1963', '1966'], 1, 'Nigeria became independent on 1 October 1960.'],
      ['The National Assembly is made up of the Senate and the…', ['House of Lords', 'House of Representatives', 'Council of State', 'Federal Executive Council'], 1, 'Nigeria has a bicameral legislature: 109 senators and 360 representatives.'],
      ['Nigeria became a republic in which year?', ['1960', '1963', '1979', '1999'], 1, 'Nigeria became a federal republic on 1 October 1963.'],
      ['Which river joins the Niger at Lokoja?', ['Benue', 'Ogun', 'Kaduna', 'Cross'], 0, 'The Niger and the Benue meet at Lokoja, Kogi State.'],
      ["Who was Nigeria's first President?", ['Abubakar Tafawa Balewa', 'Nnamdi Azikiwe', 'Obafemi Awolowo', 'Ahmadu Bello'], 1, 'Nnamdi Azikiwe became President when Nigeria became a republic in 1963.'],
      ["Who was Nigeria's first Prime Minister?", ['Abubakar Tafawa Balewa', 'Nnamdi Azikiwe', 'Herbert Macaulay', 'Yakubu Gowon'], 0, 'Sir Abubakar Tafawa Balewa led the government from independence until 1966.'],
      ['How many vertical stripes are on the Nigerian flag?', ['2', '3', '4', '5'], 1, 'Green, white, green: three vertical stripes.'],
      ['How many geopolitical zones is Nigeria divided into?', ['4', '5', '6', '8'], 2, 'North Central, North East, North West, South East, South South and South West.'],
      ["What is Nigeria's official language?", ['Hausa', 'Yoruba', 'Igbo', 'English'], 3, 'English is the official language; Nigeria has over 500 indigenous languages.'],
    ]
  },
  {
    slug: 'sports-desk', title: 'Sports desk', category: 'Sports',
    description: 'Super Eagles, Falcons, athletics and the moments fans remember.',
    seconds_per_question: 15, points_per_correct: 10, questions_per_attempt: 10, questions: [
      ["What is the nickname of Nigeria's senior men's football team?", ['Flying Eagles', 'Super Eagles', 'Golden Eaglets', 'Green Falcons'], 1, "The senior men's team is the Super Eagles."],
      ['Nigeria won Olympic football gold at which Games?', ['Seoul 1988', 'Barcelona 1992', 'Atlanta 1996', 'Sydney 2000'], 2, 'The "Dream Team" won gold at Atlanta 1996.'],
      ["The Super Falcons represent Nigeria in which sport?", ["Women's football", "Women's basketball", 'Volleyball', 'Handball'], 0, "The Super Falcons are the senior women's football team and many-time African champions."],
      ['How many players does a football team have on the pitch?', ['9', '10', '11', '12'], 2, 'Each side fields 11 players, including the goalkeeper.'],
      ['Which Nigerian set the 100m hurdles world record in 2022?', ['Blessing Okagbare', 'Tobi Amusan', 'Favour Ofili', 'Ese Brume'], 1, 'Tobi Amusan ran 12.12s at the 2022 World Championships in Eugene.'],
      ['The Africa Cup of Nations is organised by which body?', ['FIFA', 'UEFA', 'CAF', 'WAFU'], 2, 'The Confederation of African Football runs AFCON.'],
      ['Nigeria won its first Africa Cup of Nations in which year?', ['1976', '1980', '1988', '1994'], 1, 'Nigeria won the 1980 tournament on home soil in Lagos.'],
      ["Who won Nigeria's first individual Olympic gold medal?", ['Chioma Ajunwa', 'Mary Onyali', 'Falilat Ogunkoya', 'Blessing Okagbare'], 0, 'Chioma Ajunwa won the long jump at Atlanta 1996.'],
      ['Which Nigerian was African Footballer of the Year in 1996 and 1999?', ['Jay-Jay Okocha', 'Rashidi Yekini', 'Nwankwo Kanu', 'Victor Osimhen'], 2, 'Nwankwo Kanu won the award twice.'],
      ['How long is a full marathon?', ['21.1 km', '30 km', '42.195 km', '50 km'], 2, 'A marathon is 42.195 km; a half marathon is about 21.1 km.'],
      ['In basketball, a shot made from beyond the arc is worth…', ['1 point', '2 points', '3 points', '4 points'], 2, 'Shots from outside the three-point line score 3.'],
      ['How often is the FIFA World Cup held?', ['Every 2 years', 'Every 3 years', 'Every 4 years', 'Every 5 years'], 2, "The men's and women's World Cups are each held every four years."],
    ]
  },
  {
    slug: 'business-and-money', title: 'Business & money', category: 'Business',
    description: 'Markets, the naira and the institutions behind the headlines.',
    seconds_per_question: 20, points_per_correct: 12, questions_per_attempt: 10, questions: [
      ['Which institution sets monetary policy in Nigeria?', ['Ministry of Finance', 'Central Bank of Nigeria', 'SEC', 'NDIC'], 1, "The CBN's Monetary Policy Committee sets the benchmark rate."],
      ['What does GDP stand for?', ['Gross Domestic Product', 'General Development Plan', 'Gross Debt Position', 'Government Deposit Policy'], 0, 'GDP measures the value of goods and services produced in a country.'],
      ['The Nigerian Exchange Group is headquartered in which city?', ['Abuja', 'Port Harcourt', 'Lagos', 'Kano'], 2, 'NGX is based in Lagos.'],
      ['A sustained rise in the general price level is called…', ['Deflation', 'Inflation', 'Recession', 'Devaluation'], 1, 'Inflation is tracked monthly by the National Bureau of Statistics.'],
      ["What is Nigeria's main export earner?", ['Cocoa', 'Crude oil', 'Groundnuts', 'Rubber'], 1, 'Crude oil and gas dominate export revenue.'],
      ['Which agency regulates the capital market?', ['SEC', 'NAFDAC', 'FIRS', 'NCC'], 0, 'The Securities and Exchange Commission regulates capital markets.'],
      ["What is the name of Nigeria's currency?", ['Cedi', 'Naira', 'Rand', 'Shilling'], 1, 'The naira replaced the Nigerian pound in 1973.'],
      ['One naira is divided into 100…', ['Cents', 'Pesewas', 'Kobo', 'Pence'], 2, 'The kobo is the naira’s subunit.'],
      ['Which body insures bank deposits in Nigeria?', ['NDIC', 'CBN', 'SEC', 'PenCom'], 0, 'The Nigeria Deposit Insurance Corporation protects depositors if a bank fails.'],
      ['What does VAT stand for?', ['Value Added Tax', 'Variable Asset Tariff', 'Verified Account Transfer', 'Volume Adjusted Trade'], 0, 'VAT is a consumption tax charged on goods and services.'],
      ['A market in which share prices are falling over time is called a…', ['Bull market', 'Bear market', 'Flea market', 'Free market'], 1, 'Bear markets fall; bull markets rise.'],
      ['Nigeria joined OPEC in which year?', ['1960', '1965', '1971', '1980'], 2, 'Nigeria became a member of the Organization of the Petroleum Exporting Countries in 1971.'],
    ]
  },
  {
    slug: 'healthwise-check', title: 'HealthWise check', category: 'HealthWise',
    description: 'Everyday health facts worth knowing.',
    seconds_per_question: 20, points_per_correct: 10, questions_per_attempt: 10, questions: [
      ['Which mosquito transmits malaria?', ['Aedes', 'Culex', 'Anopheles', 'Mansonia'], 2, 'Female Anopheles mosquitoes carry the malaria parasite.'],
      ['Which vitamin does the body make when skin is exposed to sunlight?', ['Vitamin A', 'Vitamin C', 'Vitamin D', 'Vitamin K'], 2, 'Sunlight triggers vitamin D production in the skin.'],
      ['Which regulator approves food and drugs in Nigeria?', ['NAFDAC', 'SON', 'NCDC', 'NHIA'], 0, 'NAFDAC regulates food, drugs, cosmetics and chemicals.'],
      ['A normal adult resting heart rate is roughly…', ['20–40 bpm', '60–100 bpm', '120–150 bpm', '160–200 bpm'], 1, 'Most adults rest between 60 and 100 beats per minute.'],
      ['Oral rehydration solution is mainly used to treat…', ['Dehydration from diarrhoea', 'Headaches', 'Malaria', 'Hypertension'], 0, 'ORS replaces fluids and salts lost through diarrhoea.'],
      ['How many chambers does the human heart have?', ['2', '3', '4', '5'], 2, 'Two atria and two ventricles.'],
      ['Which organ produces insulin?', ['Liver', 'Pancreas', 'Kidney', 'Spleen'], 1, 'Insulin is made by beta cells in the pancreas.'],
      ['Which blood type can be given to people of any blood group in an emergency?', ['A positive', 'B negative', 'AB positive', 'O negative'], 3, 'O negative red cells are the universal donor type.'],
      ['Normal human body temperature is about…', ['35°C', '37°C', '39°C', '41°C'], 1, 'Around 37°C; above 38°C is usually a fever.'],
      ['Scurvy is caused by a lack of which vitamin?', ['Vitamin A', 'Vitamin B12', 'Vitamin C', 'Vitamin D'], 2, 'Fresh fruit and vegetables provide vitamin C.'],
      ["Which nutrient is the body's main source of energy?", ['Carbohydrates', 'Vitamins', 'Minerals', 'Water'], 0, 'Carbohydrates are broken down into glucose for energy.'],
      ['Which agency leads disease surveillance and outbreak response in Nigeria?', ['NAFDAC', 'NCDC', 'NHIA', 'SON'], 1, 'The Nigeria Centre for Disease Control and Prevention.'],
    ]
  },
  {
    slug: 'around-lagos', title: 'Around Lagos', category: 'Metro Plus',
    description: "Places, landmarks and life in Nigeria's busiest city.",
    seconds_per_question: 15, points_per_correct: 10, questions_per_attempt: 10, questions: [
      ['Which is the longest bridge linking Lagos Island to the mainland?', ['Carter Bridge', 'Eko Bridge', 'Third Mainland Bridge', 'Lekki-Ikoyi Link'], 2, 'Third Mainland Bridge runs about 11.8km.'],
      ['Lagos State was created in which year?', ['1960', '1967', '1976', '1991'], 1, 'Lagos State was created on 27 May 1967.'],
      ['Which agency manages traffic in Lagos State?', ['FRSC', 'LASTMA', 'NURTW', 'LAWMA'], 1, 'The Lagos State Traffic Management Authority.'],
      ['BRT in Lagos stands for…', ['Bus Rapid Transit', 'Blue Rail Train', 'Bridge Road Tax', 'Bus Route Ticket'], 0, 'Bus Rapid Transit, with dedicated lanes.'],
      ['Which agency handles waste management in Lagos?', ['LAWMA', 'LASEPA', 'LASTMA', 'LASBCA'], 0, 'The Lagos Waste Management Authority.'],
      ['What is the capital of Lagos State?', ['Lagos Island', 'Ikeja', 'Epe', 'Badagry'], 1, 'Ikeja is the state capital and seat of government.'],
      ['Lagos was the capital of Nigeria until which year?', ['1976', '1987', '1991', '1999'], 2, 'The capital moved to Abuja in December 1991.'],
      ['How many local government areas does Lagos State have?', ['16', '20', '36', '44'], 1, 'Lagos has 20 LGAs, plus 37 local council development areas.'],
      ['The Lagos Blue Line rail starts from which terminal?', ['Marina', 'Agbado', 'Ikeja', 'Lekki'], 0, 'The Blue Line runs from Marina towards Mile 2 and Okokomaiko.'],
      ['The Lagos Red Line rail runs between Agbado and…', ['Marina', 'Oyingbo', 'Ajah', 'Badagry'], 1, 'The Red Line links Agbado in Ogun State with Oyingbo on the mainland.'],
      ['Which Lagos festival features white-robed masquerades called Adamu Orisa?', ['Eyo', 'Osun-Osogbo', 'Argungu', 'Durbar'], 0, 'The Eyo festival is unique to Lagos Island.'],
      ['Balogun Market, known for fabrics and textiles, is in which part of Lagos?', ['Ikeja', 'Lagos Island', 'Surulere', 'Ikorodu'], 1, 'Balogun Market sprawls across Lagos Island near Broad Street.'],
    ]
  }
];

// [name, description, cost, stock, kind]
module.exports.rewards = [
  ['E-Paper, 1 week', 'Seven days of full digital access to the daily paper.', 150, 200, 'digital'],
  ['E-Paper, 1 month', 'A month of the daily paper on any device.', 500, 100, 'digital'],
  ['₦500 airtime', 'Any network, sent to the phone number on your profile.', 300, 150, 'airtime'],
  ['₦1,000 airtime', 'Any network, sent to the phone number on your profile.', 550, 80, 'airtime'],
  ['Branded mug', 'Collect at the Magboro office or have it delivered within Lagos.', 900, 25, 'merch'],
  ['NextGen tote bag', 'Sturdy canvas tote from a limited run.', 1200, 1, 'merch'],
];
