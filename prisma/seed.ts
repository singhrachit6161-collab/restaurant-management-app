import { PrismaClient, Role, SpicyLevel } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

function tableCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const restaurant = await prisma.restaurant.upsert({
    where: { id: "demo-restaurant" },
    update: {},
    create: {
      id: "demo-restaurant",
      name: "The Copper Spoon",
      address: "12 MG Road, Bengaluru",
      gstNumber: "29ABCDE1234F1Z5",
      currency: "INR",
      taxRatePercent: 5,
      serviceChargePercent: 5,
    },
  });

  const users: { email: string; name: string; role: Role }[] = [
    { email: "owner@restaurantos.dev", name: "Aarav Owner", role: Role.OWNER },
    { email: "manager@restaurantos.dev", name: "Meera Manager", role: Role.MANAGER },
    { email: "cashier@restaurantos.dev", name: "Kabir Cashier", role: Role.CASHIER },
    { email: "waiter@restaurantos.dev", name: "Priya Waiter", role: Role.WAITER },
    { email: "chef@restaurantos.dev", name: "Rohan Chef", role: Role.CHEF },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, restaurantId: restaurant.id },
    });
  }

  const tableNames = ["T1", "T2", "T3", "T4", "T5", "T6"];
  const tables = [];
  for (const name of tableNames) {
    const existing = await prisma.table.findFirst({ where: { restaurantId: restaurant.id, name } });
    if (existing) {
      tables.push(existing);
      continue;
    }
    const t = await prisma.table.create({
      data: {
        restaurantId: restaurant.id,
        name,
        code: tableCode(),
        capacity: 4,
      },
    });
    tables.push(t);
  }

  const categoriesData = [
    { name: "Starters", sortOrder: 0 },
    { name: "Main Course", sortOrder: 1 },
    { name: "Breads & Rice", sortOrder: 2 },
    { name: "Beverages", sortOrder: 3 },
    { name: "Desserts", sortOrder: 4 },
  ];

  const categories: Record<string, string> = {};
  for (const c of categoriesData) {
    const existing = await prisma.menuCategory.findFirst({
      where: { restaurantId: restaurant.id, name: c.name },
    });
    const cat =
      existing ??
      (await prisma.menuCategory.create({
        data: { ...c, restaurantId: restaurant.id },
      }));
    categories[c.name] = cat.id;
  }

  const itemsData = [
    { name: "Paneer Tikka", category: "Starters", price: 220, isVeg: true, spicyLevel: SpicyLevel.MEDIUM, prepTimeMinutes: 15, calories: 280, isBestseller: true },
    { name: "Chicken 65", category: "Starters", price: 260, isVeg: false, spicyLevel: SpicyLevel.HOT, prepTimeMinutes: 18, calories: 320 },
    { name: "Veg Spring Rolls", category: "Starters", price: 180, isVeg: true, spicyLevel: SpicyLevel.MILD, prepTimeMinutes: 12, calories: 210 },
    { name: "Butter Chicken", category: "Main Course", price: 340, isVeg: false, spicyLevel: SpicyLevel.MEDIUM, prepTimeMinutes: 22, calories: 460, isBestseller: true },
    { name: "Paneer Butter Masala", category: "Main Course", price: 300, isVeg: true, spicyLevel: SpicyLevel.MILD, prepTimeMinutes: 20, calories: 410 },
    { name: "Dal Makhani", category: "Main Course", price: 240, isVeg: true, spicyLevel: SpicyLevel.MILD, prepTimeMinutes: 18, calories: 350 },
    { name: "Hyderabadi Biryani", category: "Main Course", price: 320, isVeg: false, spicyLevel: SpicyLevel.MEDIUM, prepTimeMinutes: 25, calories: 520, isBestseller: true },
    { name: "Butter Naan", category: "Breads & Rice", price: 60, isVeg: true, spicyLevel: SpicyLevel.NONE, prepTimeMinutes: 8, calories: 180 },
    { name: "Jeera Rice", category: "Breads & Rice", price: 150, isVeg: true, spicyLevel: SpicyLevel.NONE, prepTimeMinutes: 10, calories: 260 },
    { name: "Masala Chaas", category: "Beverages", price: 70, isVeg: true, spicyLevel: SpicyLevel.MILD, prepTimeMinutes: 5, calories: 90 },
    { name: "Fresh Lime Soda", category: "Beverages", price: 90, isVeg: true, spicyLevel: SpicyLevel.NONE, prepTimeMinutes: 5, calories: 60 },
    { name: "Gulab Jamun", category: "Desserts", price: 110, isVeg: true, spicyLevel: SpicyLevel.NONE, prepTimeMinutes: 6, calories: 300, isBestseller: true },
  ];

  for (const [i, item] of itemsData.entries()) {
    const existing = await prisma.menuItem.findFirst({
      where: { restaurantId: restaurant.id, name: item.name },
    });
    if (existing) continue;
    await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categories[item.category],
        name: item.name,
        description: `Freshly prepared ${item.name}`,
        price: item.price,
        isVeg: item.isVeg,
        spicyLevel: item.spicyLevel,
        prepTimeMinutes: item.prepTimeMinutes,
        calories: item.calories,
        isBestseller: item.isBestseller ?? false,
        sortOrder: i,
      },
    });
  }

  console.log("Seed complete.");
  console.log("Demo login password for all accounts: demo1234");
  console.log(
    "Table QR codes:",
    tables.map((t) => `${t.name}: /order/${t.code}`).join(", ")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
