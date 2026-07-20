import { PrismaClient, Role, SpicyLevel, IngredientUnit } from "@prisma/client";
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
    { email: "inventory@restaurantos.dev", name: "Sana Inventory", role: Role.INVENTORY_MANAGER },
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

  const soon = new Date();
  soon.setDate(soon.getDate() + 2);

  const ingredientsData: {
    name: string;
    unit: IngredientUnit;
    costPerUnit: number;
    currentStock: number;
    lowStockThreshold: number;
    supplierName: string;
    expiryDate?: Date;
  }[] = [
    { name: "Basmati Rice", unit: IngredientUnit.KG, costPerUnit: 120, currentStock: 20, lowStockThreshold: 4, supplierName: "Krishna Grains" },
    { name: "Chicken", unit: IngredientUnit.KG, costPerUnit: 220, currentStock: 15, lowStockThreshold: 3, supplierName: "Farm Fresh Poultry" },
    { name: "Paneer", unit: IngredientUnit.KG, costPerUnit: 320, currentStock: 1.5, lowStockThreshold: 2, supplierName: "Amul Dairy" },
    { name: "Tomato", unit: IngredientUnit.KG, costPerUnit: 40, currentStock: 10, lowStockThreshold: 2, supplierName: "Local Mandi" },
    { name: "Onion", unit: IngredientUnit.KG, costPerUnit: 30, currentStock: 12, lowStockThreshold: 2, supplierName: "Local Mandi" },
    { name: "Cooking Oil", unit: IngredientUnit.L, costPerUnit: 150, currentStock: 10, lowStockThreshold: 2, supplierName: "Sunrise Oils" },
    { name: "Butter", unit: IngredientUnit.KG, costPerUnit: 450, currentStock: 3, lowStockThreshold: 1, supplierName: "Amul Dairy" },
    { name: "Fresh Cream", unit: IngredientUnit.L, costPerUnit: 280, currentStock: 4, lowStockThreshold: 1, supplierName: "Amul Dairy" },
    { name: "Wheat Flour", unit: IngredientUnit.KG, costPerUnit: 45, currentStock: 15, lowStockThreshold: 3, supplierName: "Krishna Grains" },
    { name: "Sugar", unit: IngredientUnit.KG, costPerUnit: 45, currentStock: 8, lowStockThreshold: 2, supplierName: "Krishna Grains" },
    { name: "Lime", unit: IngredientUnit.PCS, costPerUnit: 8, currentStock: 60, lowStockThreshold: 15, supplierName: "Local Mandi" },
    { name: "Buttermilk", unit: IngredientUnit.L, costPerUnit: 60, currentStock: 5, lowStockThreshold: 1, supplierName: "Amul Dairy" },
    { name: "Spice Mix", unit: IngredientUnit.KG, costPerUnit: 400, currentStock: 2, lowStockThreshold: 0.5, supplierName: "Spice Bazaar" },
    { name: "Cabbage", unit: IngredientUnit.KG, costPerUnit: 35, currentStock: 5, lowStockThreshold: 1, supplierName: "Local Mandi" },
    { name: "Spring Roll Wrapper", unit: IngredientUnit.PCS, costPerUnit: 5, currentStock: 100, lowStockThreshold: 20, supplierName: "Spice Bazaar" },
    { name: "Khoya", unit: IngredientUnit.KG, costPerUnit: 280, currentStock: 2, lowStockThreshold: 0.5, supplierName: "Amul Dairy", expiryDate: soon },
    { name: "Dal", unit: IngredientUnit.KG, costPerUnit: 90, currentStock: 6, lowStockThreshold: 1.5, supplierName: "Krishna Grains" },
  ];

  const ingredientIds: Record<string, string> = {};
  for (const ing of ingredientsData) {
    const existing = await prisma.ingredient.findFirst({
      where: { restaurantId: restaurant.id, name: ing.name },
    });
    if (existing) {
      ingredientIds[ing.name] = existing.id;
      continue;
    }
    const created = await prisma.ingredient.create({
      data: { ...ing, restaurantId: restaurant.id },
    });
    ingredientIds[ing.name] = created.id;
    if (created.currentStock > 0) {
      await prisma.stockMovement.create({
        data: {
          ingredientId: created.id,
          type: "ADJUSTMENT",
          quantity: created.currentStock,
          note: "Initial stock",
        },
      });
    }
  }

  const recipesData: Record<string, { ingredient: string; quantity: number }[]> = {
    "Paneer Tikka": [
      { ingredient: "Paneer", quantity: 0.15 },
      { ingredient: "Onion", quantity: 0.02 },
      { ingredient: "Spice Mix", quantity: 0.01 },
    ],
    "Chicken 65": [
      { ingredient: "Chicken", quantity: 0.2 },
      { ingredient: "Cooking Oil", quantity: 0.03 },
      { ingredient: "Spice Mix", quantity: 0.015 },
    ],
    "Veg Spring Rolls": [
      { ingredient: "Cabbage", quantity: 0.1 },
      { ingredient: "Spring Roll Wrapper", quantity: 4 },
      { ingredient: "Cooking Oil", quantity: 0.02 },
    ],
    "Butter Chicken": [
      { ingredient: "Chicken", quantity: 0.25 },
      { ingredient: "Butter", quantity: 0.03 },
      { ingredient: "Fresh Cream", quantity: 0.05 },
      { ingredient: "Tomato", quantity: 0.1 },
      { ingredient: "Onion", quantity: 0.05 },
    ],
    "Paneer Butter Masala": [
      { ingredient: "Paneer", quantity: 0.15 },
      { ingredient: "Butter", quantity: 0.025 },
      { ingredient: "Fresh Cream", quantity: 0.04 },
      { ingredient: "Tomato", quantity: 0.12 },
    ],
    "Dal Makhani": [
      { ingredient: "Dal", quantity: 0.12 },
      { ingredient: "Butter", quantity: 0.02 },
      { ingredient: "Fresh Cream", quantity: 0.03 },
    ],
    "Hyderabadi Biryani": [
      { ingredient: "Basmati Rice", quantity: 0.2 },
      { ingredient: "Chicken", quantity: 0.18 },
      { ingredient: "Onion", quantity: 0.05 },
      { ingredient: "Spice Mix", quantity: 0.02 },
    ],
    "Butter Naan": [
      { ingredient: "Wheat Flour", quantity: 0.08 },
      { ingredient: "Butter", quantity: 0.01 },
    ],
    "Jeera Rice": [
      { ingredient: "Basmati Rice", quantity: 0.15 },
      { ingredient: "Cooking Oil", quantity: 0.01 },
    ],
    "Masala Chaas": [
      { ingredient: "Buttermilk", quantity: 0.2 },
      { ingredient: "Spice Mix", quantity: 0.005 },
    ],
    "Fresh Lime Soda": [
      { ingredient: "Lime", quantity: 1 },
      { ingredient: "Sugar", quantity: 0.02 },
    ],
    "Gulab Jamun": [
      { ingredient: "Khoya", quantity: 0.06 },
      { ingredient: "Sugar", quantity: 0.03 },
    ],
  };

  for (const [itemName, lines] of Object.entries(recipesData)) {
    const menuItem = await prisma.menuItem.findFirst({
      where: { restaurantId: restaurant.id, name: itemName },
    });
    if (!menuItem) continue;
    const existingRecipe = await prisma.recipeIngredient.count({ where: { menuItemId: menuItem.id } });
    if (existingRecipe > 0) continue;
    await prisma.recipeIngredient.createMany({
      data: lines.map((l) => ({
        menuItemId: menuItem.id,
        ingredientId: ingredientIds[l.ingredient],
        quantity: l.quantity,
      })),
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
