// Creates the tables (if needed) and loads the full Al-Rizwan menu into Neon.
// Run once after setting DATABASE_URL:   npm run seed
// Safe to re-run — it wipes and reloads menu content, but leaves admin_log alone.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');

const CATEGORIES = [
  {
    id: 'parathas', icon: '🫓', label: 'Parathas', sort_order: 1,
    title: 'Classic Parathas', description: 'Fresh off the tawa, every single time.',
    groups: [
      { name: 'Rate List', items: [
        ['Sada Paratha (Lacha)', 'سادہ پراٹھا (لچھا)', 80],
        ['Desi Aatay ka Paratha', 'دیسی آٹے کا پراٹھا', 80],
        ['Anday wala Paratha', 'انڈے والا پراٹھا', 150],
        ['Aloo Anda Paratha', 'آلو انڈا پراٹھا', 270],
        ['Aloo wala Paratha', 'آلو والا پراٹھا', 200],
        ['Chicken Vegetable Paratha', 'چکن ویجیٹیبل پراٹھا', 380],
        ['Chicken Anday wala Paratha', 'چکن انڈے والا پراٹھا', 440],
        ['Qeema Anday wala Paratha', 'قیمہ انڈے والا پراٹھا', 440],
        ['Qeemay wala Paratha', 'قیمے والا پراٹھا', 380],
        ['Chocolate Paratha', 'چاکلیٹ پراٹھا', 270],
        ['Malai Chocolate Paratha', 'ملائی چاکلیٹ پراٹھا', 320],
        ['Chicken Chapli Kabab', 'چکن چپلی کباب', 200],
        ['Beef Chapli Kabab', 'بیف چپلی کباب', 200],
        ['Mooli Wala Paratha', 'مولی والا پراٹھا', 200],
        ['Boil Egg', 'ابلا انڈا', 60],
      ]},
    ]
  },
  {
    id: 'cheese', icon: '🧀', label: 'Cheese Paratha', sort_order: 2,
    title: 'Cheese Parathas', description: 'Extra gooey, extra happy.',
    groups: [
      { name: 'Cheese Range', items: [
        ['Lacha Cheese Paratha', 'لچھا چیز پراٹھا', 400],
        ['Aloo Cheese Paratha', 'آلو چیز پراٹھا', 500],
        ['Omlet Cheese Paratha', 'آملیٹ چیز پراٹھا', 450],
        ['Chicken Cheese Paratha', 'چکن چیز پراٹھا', 600],
        ['Qeema Cheese Paratha', 'قیمہ چیز پراٹھا', 600],
      ]},
      { name: 'Chai, Lassi & More', items: [
        ['Anda Omelette / Fry', 'انڈا آملیٹ / فرائی', 70],
        ['Gurr Wala Paratha', 'گڑ والا پراٹھا', 150],
        ['Special Karak Chai', 'سپیشل کرک چائے', 100],
        ['Gurr Wali Chai', 'گڑ والی چائے', 120],
        ['Meethi Lassi', 'میٹھی لسی', 200],
        ['Meetha Dahi', 'میٹھا دہی', 150],
        ['Meetha Bread Pcs', 'میٹھا بریڈ پیس', 80],
        ['National Achar Sachet', 'نیشنل اچار ساشے', 20],
        ['Kashmiri Green Tea', 'کشمیری گرین چائے', 150],
        ['Afghani Qahwa', 'افغانی قہوہ', 100],
      ]},
    ]
  },
  {
    id: 'shawarma', icon: '🌯', label: 'Shawarma', sort_order: 3,
    title: 'Turkish Shawarma', description: 'Straight off the rotating spit.',
    groups: [
      { name: 'Turkish Shawarma', items: [
        ['Sarookh Shawarma', 'شاورما صاروخ', 600],
        ['Fateer Shawarma', 'شاورما فطیر', 600],
        ['Shawarma with Cheese Medium', 'شاورما بالجبن وسط', 600],
        ['Shawarma with Cheese Large', 'شاورما بالجبن کبیر', 700],
        ['Samoon Shawarma (Pocket)', 'شاورما الصمون', 500],
        ['Zinger Shawarma', 'زنجر شاورما', 450],
      ]},
      { name: 'Plater Shawarma  ·  Small / Med / Large', items: [
        ['Plater Shawarma — Small', 'صحن عربی صغیر', 1150],
        ['Plater Shawarma — Medium', 'صحن عربی وسط', 1700],
        ['Plater Shawarma — Large', 'صحن عربی کبیر', 2200],
      ]},
      { name: 'Mutabbaq', items: [
        ['Mutton Mutabbaq', 'مطبق لحم', 900],
        ['Mutton Mutabbaq Cheese', 'مطبق لحم جبن', 950],
        ['Chicken Mutabbaq Cheese', 'مطبق دجاج جبن', 700],
      ]},
    ]
  },
  {
    id: 'pizza', icon: '🍕', label: 'Pizza & Fatayer', sort_order: 4,
    title: 'Turkish Pizza & Fatayer', description: 'Wood-fired flavour, Lahore style.',
    groups: [
      { name: 'Turkish Pizza', items: [
        ['Vegetable Pizza', 'بیزا الخضار', 900],
        ['Cheese Pizza', 'بیزا جبن', 800],
        ['Cheese Pizza Large', 'بیزا جبن کبیر', 1600],
        ['Chicken Pizza Medium', 'بیزا دجاج وسط', 1020],
        ['Chicken Pizza Large', 'بیزا دجاج کبیر', 1800],
        ['Mutton Pizza Medium', 'بیزا الحم وسط', 1300],
        ['Mutton Pizza Large', 'بیزا الحم کبیر', 2100],
        ['Veg. Chicken Olive Mix Medium', 'بیزا مشکل وسط', 1180],
        ['Veg. Chicken Olive Mix Large', 'بیزا مشکل کبیر', 1950],
      ]},
      { name: 'Turkish Fatayer', items: [
        ['Aish ul Buibul', 'عيش البلبل', 930],
        ['Lubana Zaatar', 'لبنه زعتر', 1000],
        ['Juban Zaatar', 'جبن زعتر', 1000],
        ['Fatayer Chicken Egg', 'فطایر دجاج بیض', 850],
        ['Fatayer Mutton Egg', 'فطایر لحم بیض', 900],
        ['Fatayer Shinga La La', 'فطایر شنقا لالا', 900],
        ['Fatayer Istanbul Special', 'فطایر استنبول سبیشل', 1350],
        ['Family Fatayer', 'فطایر عائلة', 2500],
      ]},
    ]
  },
  {
    id: 'falafil', icon: '🧆', label: 'Falafil', sort_order: 5,
    title: 'Falafil', description: 'Crisp, fresh & herby — sandwich or plate.',
    groups: [
      { name: 'Falafil Sandwich', items: [
        ['Sandwich Falafil Simple', 'ساندویتش فلافل', 370],
        ['Sandwich Falafil with Humus', 'ساندویتش فلافل مع حمص', 490],
        ['Sandwich Falafil Mix', 'ساندویتش فلافل مشکل', 560],
      ]},
      { name: 'Falafil Plate', items: [
        ['Falafil Plate — Medium', 'صحن فلافل وسط', 1170],
        ['Falafil Plate — Large', 'صحن فلافل کبیر', 1550],
      ]},
      { name: 'Crispy', items: [
        ['Nuggets 5 Pcs', 'ناجتس 5 حبات', 350],
        ['Crispy Hot Wings 5 Pcs', 'ونجز حاره مقرمشة 5 حبات', 400],
      ]},
    ]
  },
  {
    id: 'sides', icon: '🍯', label: 'Sides & Sweets', sort_order: 6,
    title: 'Sides, Dips & Sweets', description: 'The little extras that finish the plate.',
    groups: [
      { name: 'Kings Sweet Food', items: [
        ['Ash Bulbul', 'عش البلبل', 870],
        ['Masoob King', 'معصوب ملکی', 870],
        ['Masoob Bilgishta', 'معصوب با لقشطه', 650],
      ]},
      { name: 'Sides', items: [
        ['Humus', 'حمص', 620],
        ['Plain Fries', 'سحن بطاطس', 370],
        ['Potato Wedges', 'بطاطس ودجز', 370],
        ['Potato Bites', 'بطاطس بايتس', 650],
        ['Cheese Croquettes', 'كروكيت الجبن', 980],
        ['Hash Brown', 'هاش براون', 500],
        ['Kanafa — Turkish Naan Large', 'کبیر ترکی خبز', 980],
      ]},
      { name: 'Dip Sauces', items: [
        ['Garlic Dip', 'علبه ثوم', 60],
        ['Spicy Dip', 'علبه شطه حاره', 60],
        ['Tahiniah Dip', 'علبه طحینه', 60],
        ['Humas Dip', 'علبه حمص', 90],
      ]},
    ]
  },
  {
    id: 'shakes', icon: '🥤', label: 'Milkshakes', sort_order: 7,
    title: 'Milk Shakes', description: 'Thick, cold, and made fresh — Glass size.',
    groups: [
      { name: 'Milk Shakes  ·  Glass', items: [
        ['Peach Shake', 'آڑو شیک', 270],
        ['Mango Shake', 'آم شیک', 300],
        ['Banana Shake', 'کیلا شیک', 270],
        ['Khoya Khajoor Shake', 'کھویا کھجور شیک', 320],
        ['Banana Khajoor Shake', 'کیلا کھجور شیک', 300],
        ['Strawberry Shake', 'سٹرابیری شیک', 320],
        ['Special Fig Shake', 'سپیشل انجیر شیک', 370],
        ['Pine Apple Shake', 'پائن ایپل شیک', 320],
        ['Apple Shake', 'سیب شیک', 270],
        ['Oreo Chocolate Shake', 'اوریو چاکلیٹ شیک', 300],
        ['Special Cheekoo Shake', 'سپیشل چیکو شیک', 350],
        ['Special Papita Shake', 'سپیشل پاپیتا شیک', 350],
        ['Special Mix Dry Fruit Shake', 'سپیشل مکس ڈرائی فروٹ شیک', 750],
      ]},
    ]
  },
  {
    id: 'juices', icon: '🧃', label: 'Juices', sort_order: 8,
    title: 'Fresh Juices', description: 'Squeezed fresh, Glass size.',
    groups: [
      { name: 'Fresh Juices  ·  Glass', items: [
        ['Pine Apple Juice', 'پائن ایپل جوس', 400],
        ['Grape Fruit Juice', 'گریپ فروٹ جوس', 300],
        ['Musami Juice', 'موسمی جوس', 370],
        ['Apple Juice', 'سیب جوس', 320],
        ['Mint Margarita Juice', 'منٹ مارگریٹا جوس', 320],
        ['Strawberry Juice', 'سٹرابیری جوس', 300],
        ['Red Anar Juice', 'ریڈ انار جوس', 400],
        ['White Anar Juice', 'وائٹ انار جوس', 650],
      ]},
      { name: 'Chai & Coffee', items: [
        ['Chai', 'چائے', 70],
        ['Doodh Patti', 'دودھ پتی', 80],
        ['Gurr wali Chai', 'گڑ والی چائے', 80],
        ['Qehwa', 'قہوہ', 60],
      ]},
    ]
  },
  {
    id: 'minifatayer', icon: '🥐', label: 'Mini Fatayer', sort_order: 9,
    title: 'Arabic Mini Fatayer', description: 'Break Fast Meal — small bites, big flavour.',
    groups: [
      { name: 'Arabic Mini Fatayer (Break Fast Meal)', items: [
        ['Crosson Sweet Dish', 'کروسان سویٹ ڈش', 100],
        ['Chicken Mini Fatayer', 'فطایر دجاج صغیر', 100],
        ['Mutton Mini Fatayer', 'فطایر لحم صغیر', 100],
        ['Cheese Egg Mini Fatayer', 'فطایر جبن بیض صغیر', 100],
        ['Mini Ash Bulbul', 'مینی عش البلبل', 100],
        ['Club Sandwich', 'کلب سینڈوچ', 550],
      ]},
    ]
  },
  {
    id: 'rice', icon: '🍚', label: 'Rice', sort_order: 10,
    title: 'Rice', description: 'Al-Rizwan special rice plates.',
    groups: [
      { name: 'Rice Plates', items: [
        ['Al Rizwan Special Dal Chawal Plate', 'دال چاول پلیٹ سپیشل', 250],
        ['Al Rizwan Special Chicken Palak Chawal Plate', 'چکن پالک چاول پلیٹ سپیشل', 500],
      ]},
    ]
  },
];

async function run() {
  const client = await pool.connect();
  try {
    console.log('Applying schema...');
    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    await client.query(schema);

    console.log('Clearing existing menu content (categories/groups/items only)...');
    await client.query('TRUNCATE items, groups, categories RESTART IDENTITY CASCADE');

    for (const cat of CATEGORIES) {
      await client.query(
        `INSERT INTO categories (id, icon, label, title, description, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [cat.id, cat.icon, cat.label, cat.title, cat.description, cat.sort_order]
      );

      for (let gi = 0; gi < cat.groups.length; gi++) {
        const g = cat.groups[gi];
        const { rows } = await client.query(
          `INSERT INTO groups (category_id, name, sort_order) VALUES ($1,$2,$3) RETURNING id`,
          [cat.id, g.name, gi]
        );
        const groupId = rows[0].id;

        for (let ii = 0; ii < g.items.length; ii++) {
          const [name, urdu, price, price2] = g.items[ii];
          await client.query(
            `INSERT INTO items (group_id, name, urdu, price, price2, available, sort_order)
             VALUES ($1,$2,$3,$4,$5,true,$6)`,
            [groupId, name, urdu, price, price2 ?? null, ii]
          );
        }
      }
    }

    console.log('✅ Seed complete — menu loaded into Neon.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
