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

  const suppliersData = [
    { name: "Krishna Grains", contactPerson: "Vikram Krishna", phone: "+91 98450 11223", email: "orders@krishnagrains.example" },
    { name: "Farm Fresh Poultry", contactPerson: "Deepak Rao", phone: "+91 98450 22334", email: "sales@farmfreshpoultry.example" },
    { name: "Amul Dairy", contactPerson: "Amul Distribution Desk", phone: "+91 98450 33445", email: "b2b@amuldairy.example" },
    { name: "Local Mandi", contactPerson: "Ramesh Traders", phone: "+91 98450 44556" },
    { name: "Sunrise Oils", contactPerson: "Anita Shah", phone: "+91 98450 55667", email: "orders@sunriseoils.example" },
    { name: "Spice Bazaar", contactPerson: "Farhan Ali", phone: "+91 98450 66778", email: "wholesale@spicebazaar.example" },
  ];

  const supplierIds: Record<string, string> = {};
  for (const s of suppliersData) {
    const existing = await prisma.supplier.findFirst({ where: { restaurantId: restaurant.id, name: s.name } });
    const supplier = existing ?? (await prisma.supplier.create({ data: { ...s, restaurantId: restaurant.id } }));
    supplierIds[s.name] = supplier.id;
  }

  const ingredientsData: {
    name: string;
    unit: IngredientUnit;
    costPerUnit: number;
    currentStock: number;
    lowStockThreshold: number;
    supplier: string;
    expiryDate?: Date;
  }[] = [
    { name: "Basmati Rice", unit: IngredientUnit.KG, costPerUnit: 120, currentStock: 20, lowStockThreshold: 4, supplier: "Krishna Grains" },
    { name: "Chicken", unit: IngredientUnit.KG, costPerUnit: 220, currentStock: 15, lowStockThreshold: 3, supplier: "Farm Fresh Poultry" },
    { name: "Paneer", unit: IngredientUnit.KG, costPerUnit: 320, currentStock: 1.5, lowStockThreshold: 2, supplier: "Amul Dairy" },
    { name: "Tomato", unit: IngredientUnit.KG, costPerUnit: 40, currentStock: 10, lowStockThreshold: 2, supplier: "Local Mandi" },
    { name: "Onion", unit: IngredientUnit.KG, costPerUnit: 30, currentStock: 12, lowStockThreshold: 2, supplier: "Local Mandi" },
    { name: "Cooking Oil", unit: IngredientUnit.L, costPerUnit: 150, currentStock: 10, lowStockThreshold: 2, supplier: "Sunrise Oils" },
    { name: "Butter", unit: IngredientUnit.KG, costPerUnit: 450, currentStock: 3, lowStockThreshold: 1, supplier: "Amul Dairy" },
    { name: "Fresh Cream", unit: IngredientUnit.L, costPerUnit: 280, currentStock: 4, lowStockThreshold: 1, supplier: "Amul Dairy" },
    { name: "Wheat Flour", unit: IngredientUnit.KG, costPerUnit: 45, currentStock: 15, lowStockThreshold: 3, supplier: "Krishna Grains" },
    { name: "Sugar", unit: IngredientUnit.KG, costPerUnit: 45, currentStock: 8, lowStockThreshold: 2, supplier: "Krishna Grains" },
    { name: "Lime", unit: IngredientUnit.PCS, costPerUnit: 8, currentStock: 60, lowStockThreshold: 15, supplier: "Local Mandi" },
    { name: "Buttermilk", unit: IngredientUnit.L, costPerUnit: 60, currentStock: 5, lowStockThreshold: 1, supplier: "Amul Dairy" },
    { name: "Spice Mix", unit: IngredientUnit.KG, costPerUnit: 400, currentStock: 2, lowStockThreshold: 0.5, supplier: "Spice Bazaar" },
    { name: "Cabbage", unit: IngredientUnit.KG, costPerUnit: 35, currentStock: 5, lowStockThreshold: 1, supplier: "Local Mandi" },
    { name: "Spring Roll Wrapper", unit: IngredientUnit.PCS, costPerUnit: 5, currentStock: 100, lowStockThreshold: 20, supplier: "Spice Bazaar" },
    { name: "Khoya", unit: IngredientUnit.KG, costPerUnit: 280, currentStock: 2, lowStockThreshold: 0.5, supplier: "Amul Dairy", expiryDate: soon },
    { name: "Dal", unit: IngredientUnit.KG, costPerUnit: 90, currentStock: 6, lowStockThreshold: 1.5, supplier: "Krishna Grains" },
  ];

  const ingredientIds: Record<string, string> = {};
  for (const { supplier, ...ing } of ingredientsData) {
    const existing = await prisma.ingredient.findFirst({
      where: { restaurantId: restaurant.id, name: ing.name },
    });
    if (existing) {
      ingredientIds[ing.name] = existing.id;
      continue;
    }
    const created = await prisma.ingredient.create({
      data: { ...ing, restaurantId: restaurant.id, supplierId: supplierIds[supplier] },
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

  const existingPoCount = await prisma.purchaseOrder.count({ where: { restaurantId: restaurant.id } });
  if (existingPoCount === 0) {
    // PO 1: fully received and fully paid — demonstrates the whole lifecycle.
    const po1 = await prisma.purchaseOrder.create({
      data: {
        restaurantId: restaurant.id,
        poNumber: 7001,
        supplierId: supplierIds["Farm Fresh Poultry"],
        status: "SENT",
        items: {
          create: [{ ingredientId: ingredientIds["Chicken"], quantityOrdered: 10, unitCost: 215 }],
        },
      },
      include: { items: true },
    });
    const po1Item = po1.items[0];
    await prisma.$transaction([
      prisma.purchaseOrderItem.update({ where: { id: po1Item.id }, data: { quantityReceived: 10 } }),
      prisma.stockMovement.create({
        data: {
          ingredientId: po1Item.ingredientId,
          type: "PURCHASE",
          quantity: 10,
          note: "PO #7001",
          purchaseOrderId: po1.id,
        },
      }),
      prisma.ingredient.update({ where: { id: po1Item.ingredientId }, data: { currentStock: { increment: 10 } } }),
      prisma.purchaseOrder.update({ where: { id: po1.id }, data: { status: "RECEIVED" } }),
    ]);
    const po1Invoice = await prisma.supplierInvoice.create({
      data: {
        restaurantId: restaurant.id,
        invoiceNumber: "FFP-INV-2201",
        supplierId: supplierIds["Farm Fresh Poultry"],
        purchaseOrderId: po1.id,
        amount: 2150,
        amountPaid: 2150,
        status: "PAID",
      },
    });
    await prisma.supplierPayment.create({
      data: {
        restaurantId: restaurant.id,
        supplierId: supplierIds["Farm Fresh Poultry"],
        invoiceId: po1Invoice.id,
        amount: 2150,
        method: "BANK_TRANSFER",
        note: "Full settlement",
      },
    });

    // PO 2: partially received, invoiced for what arrived, partially paid — leaves a due balance to demo.
    const po2 = await prisma.purchaseOrder.create({
      data: {
        restaurantId: restaurant.id,
        poNumber: 7002,
        supplierId: supplierIds["Krishna Grains"],
        status: "SENT",
        items: {
          create: [
            { ingredientId: ingredientIds["Basmati Rice"], quantityOrdered: 30, unitCost: 118 },
            { ingredientId: ingredientIds["Wheat Flour"], quantityOrdered: 20, unitCost: 44 },
          ],
        },
      },
      include: { items: true },
    });
    const riceItem = po2.items.find((i) => i.ingredientId === ingredientIds["Basmati Rice"])!;
    const flourItem = po2.items.find((i) => i.ingredientId === ingredientIds["Wheat Flour"])!;
    await prisma.$transaction([
      prisma.purchaseOrderItem.update({ where: { id: riceItem.id }, data: { quantityReceived: 30 } }),
      prisma.stockMovement.create({
        data: { ingredientId: riceItem.ingredientId, type: "PURCHASE", quantity: 30, note: "PO #7002", purchaseOrderId: po2.id },
      }),
      prisma.ingredient.update({ where: { id: riceItem.ingredientId }, data: { currentStock: { increment: 30 } } }),
      prisma.purchaseOrderItem.update({ where: { id: flourItem.id }, data: { quantityReceived: 10 } }),
      prisma.stockMovement.create({
        data: { ingredientId: flourItem.ingredientId, type: "PURCHASE", quantity: 10, note: "PO #7002", purchaseOrderId: po2.id },
      }),
      prisma.ingredient.update({ where: { id: flourItem.ingredientId }, data: { currentStock: { increment: 10 } } }),
      prisma.purchaseOrder.update({ where: { id: po2.id }, data: { status: "PARTIALLY_RECEIVED" } }),
    ]);
    const po2Amount = 30 * 118 + 10 * 44; // = 3980, matches what's actually arrived so far
    const po2Invoice = await prisma.supplierInvoice.create({
      data: {
        restaurantId: restaurant.id,
        invoiceNumber: "KG-4471",
        supplierId: supplierIds["Krishna Grains"],
        purchaseOrderId: po2.id,
        amount: po2Amount,
        amountPaid: 2000,
        status: "PARTIALLY_PAID",
        dueDate: new Date(Date.now() + 14 * 86400000),
      },
    });
    await prisma.supplierPayment.create({
      data: {
        restaurantId: restaurant.id,
        supplierId: supplierIds["Krishna Grains"],
        invoiceId: po2Invoice.id,
        amount: 2000,
        method: "UPI",
        note: "Partial advance",
      },
    });
  }

  const existingCustomerCount = await prisma.customer.count({ where: { restaurantId: restaurant.id } });
  if (existingCustomerCount === 0) {
    const ananya = await prisma.customer.create({
      data: {
        restaurantId: restaurant.id,
        name: "Ananya Sharma",
        phone: "9876500001",
        email: "ananya.sharma@example.com",
        loyaltyPoints: 1200,
        lifetimePoints: 1500,
        membershipTier: "GOLD",
        referralCode: tableCode(),
      },
    });
    await prisma.loyaltyTransaction.createMany({
      data: [
        { customerId: ananya.id, restaurantId: restaurant.id, type: "EARNED", points: 500, note: "Order #1042" },
        { customerId: ananya.id, restaurantId: restaurant.id, type: "EARNED", points: 700, note: "Order #1078" },
        { customerId: ananya.id, restaurantId: restaurant.id, type: "REDEEMED", points: -300, note: "Redeemed at checkout" },
        { customerId: ananya.id, restaurantId: restaurant.id, type: "EARNED", points: 300, note: "Order #1103" },
      ],
    });

    const rahul = await prisma.customer.create({
      data: {
        restaurantId: restaurant.id,
        name: "Rahul Verma",
        phone: "9876500002",
        email: "rahul.verma@example.com",
        loyaltyPoints: 250,
        lifetimePoints: 250,
        membershipTier: "SILVER",
        referralCode: tableCode(),
        referredByCustomerId: ananya.id,
      },
    });
    await prisma.loyaltyTransaction.create({
      data: { customerId: rahul.id, restaurantId: restaurant.id, type: "EARNED", points: 250, note: "Order #1110" },
    });
    // Rahul's first paid order already triggered Ananya's referral bonus.
    await prisma.loyaltyTransaction.create({
      data: {
        customerId: ananya.id,
        restaurantId: restaurant.id,
        type: "REFERRAL_BONUS",
        points: 50,
        note: "Referral bonus for Rahul Verma's first order",
      },
    });
    await prisma.customer.update({
      where: { id: ananya.id },
      data: { loyaltyPoints: { increment: 50 }, lifetimePoints: { increment: 50 } },
    });

    await prisma.customer.create({
      data: {
        restaurantId: restaurant.id,
        name: "Priya Nair",
        phone: "9876500003",
        referralCode: tableCode(),
      },
    });

    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    await prisma.coupon.createMany({
      data: [
        {
          restaurantId: restaurant.id,
          code: "WELCOME10",
          type: "PERCENT",
          value: 10,
          minOrderValue: 200,
          maxDiscount: 100,
          validUntil: in30Days,
        },
        {
          restaurantId: restaurant.id,
          code: "FLAT50",
          type: "FLAT",
          value: 50,
          minOrderValue: 300,
          usageLimit: 100,
        },
      ],
    });
  }

  const existingReservationCount = await prisma.reservation.count({ where: { restaurantId: restaurant.id } });
  if (existingReservationCount === 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const customers = await prisma.customer.findMany({ where: { restaurantId: restaurant.id }, orderBy: { createdAt: "asc" } });
    const [ananya, rahul, priya] = customers;

    await prisma.reservation.createMany({
      data: [
        {
          restaurantId: restaurant.id,
          customerId: ananya?.id ?? null,
          customerName: ananya?.name ?? "Ananya Sharma",
          customerPhone: ananya?.phone ?? "9876500001",
          tableId: tables[0].id,
          partySize: 4,
          reservationDate: today,
          reservationTime: "12:30",
          status: "CONFIRMED",
        },
        {
          restaurantId: restaurant.id,
          customerId: priya?.id ?? null,
          customerName: priya?.name ?? "Priya Nair",
          customerPhone: priya?.phone ?? "9876500003",
          partySize: 2,
          reservationDate: today,
          reservationTime: "19:30",
          status: "PENDING",
          specialRequest: "Window seat if possible",
        },
        {
          restaurantId: restaurant.id,
          customerName: "Vikram Rao",
          customerPhone: "9876500099",
          tableId: tables[2].id,
          partySize: 3,
          reservationDate: today,
          reservationTime: "13:00",
          status: "SEATED",
        },
        {
          restaurantId: restaurant.id,
          customerId: rahul?.id ?? null,
          customerName: rahul?.name ?? "Rahul Verma",
          customerPhone: rahul?.phone ?? "9876500002",
          tableId: tables[1].id,
          partySize: 2,
          reservationDate: yesterday,
          reservationTime: "20:00",
          status: "COMPLETED",
        },
        {
          restaurantId: restaurant.id,
          customerName: "Karan Mehta",
          customerPhone: "9876500098",
          partySize: 2,
          reservationDate: yesterday,
          reservationTime: "18:30",
          status: "NO_SHOW",
        },
        {
          restaurantId: restaurant.id,
          customerId: priya?.id ?? null,
          customerName: priya?.name ?? "Priya Nair",
          customerPhone: priya?.phone ?? "9876500003",
          tableId: tables[3].id,
          partySize: 5,
          reservationDate: tomorrow,
          reservationTime: "20:00",
          status: "CONFIRMED",
          specialRequest: "Birthday cake for 5pm",
        },
      ],
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
