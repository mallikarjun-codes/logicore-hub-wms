import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB Seed...');

  // Clean existing data to allow safe re-runs
  await prisma.aIChatHistory.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.dispatchRequest.deleteMany();
  await prisma.storageRequest.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.bin.deleteMany();
  await prisma.shelf.deleteMany();
  await prisma.rack.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.company.deleteMany();
  await prisma.warehouse.deleteMany();

  console.log('Database cleaned. Creating Super Admin...');

  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@waremind.ai',
      passwordHash: 'hashed_password_placeholder', // TODO: Use proper hashing in production
      name: 'Super Administrator',
      role: 'SUPER_ADMIN',
    }
  });

  console.log('Creating Client Companies...');

  const samsung = await prisma.company.create({
    data: {
      name: 'Samsung India',
      gstNumber: '27AABCU9603R1ZX',
      address: 'Samsung Hub, New Delhi',
      contactEmail: 'logistics@samsung.in',
      billingPlan: 'ENTERPRISE',
      priority: 'HIGH'
    }
  });

  const boat = await prisma.company.create({
    data: {
      name: 'Boat Logistics Client',
      gstNumber: '27AADCB2230M1Z8',
      address: 'Boat Campus, Mumbai',
      contactEmail: 'operations@boat-lifestyle.com',
      billingPlan: 'PROFESSIONAL',
      priority: 'MEDIUM'
    }
  });

  console.log('Creating Users for Companies (Client Role)...');

  await prisma.user.createMany({
    data: [
      {
        email: 'manager@samsung.in',
        passwordHash: 'hashed_pw_1',
        name: 'Rahul Sharma',
        role: 'CLIENT',
        companyId: samsung.id
      },
      {
        email: 'ops@boat-lifestyle.com',
        passwordHash: 'hashed_pw_2',
        name: 'Neha Singh',
        role: 'CLIENT',
        companyId: boat.id
      }
    ]
  });

  console.log('Creating massive Warehouse "Alpha Hub" with Zones, Racks, Shelves, and Bins...');

  const alphaHub = await prisma.warehouse.create({
    data: {
      name: 'Alpha Hub',
      location: 'Pune Industrial Area',
      totalCapacityPallets: 10000,
      currentOccupancyPallets: 50,
      zones: {
        create: Array.from({ length: 2 }).map((_, zoneIndex) => ({
          name: `Zone ${String.fromCharCode(65 + zoneIndex)}`,
          racks: {
            create: Array.from({ length: 3 }).map((_, rackIndex) => ({
              name: `Rack ${zoneIndex + 1}0${rackIndex + 1}`,
              shelves: {
                create: Array.from({ length: 3 }).map((_, shelfIndex) => ({
                  name: `Shelf ${shelfIndex + 1}`,
                  bins: {
                    create: Array.from({ length: 2 }).map((_, binIndex) => ({
                      name: `Bin ${binIndex + 1}`
                    }))
                  }
                }))
              }
            }))
          }
        }))
      }
    },
    include: {
      zones: {
        include: {
          racks: {
            include: {
              shelves: {
                include: {
                  bins: true
                }
              }
            }
          }
        }
      }
    }
  });

  console.log('Creating Warehouse Manager and Staff assigned to "Alpha Hub"...');

  await prisma.user.createMany({
    data: [
      {
        email: 'manager@alphahub.waremind.ai',
        passwordHash: 'hashed_pw_manager',
        name: 'Amit Patel',
        role: 'WAREHOUSE_MANAGER',
        warehouseId: alphaHub.id
      },
      {
        email: 'staff1@alphahub.waremind.ai',
        passwordHash: 'hashed_pw_staff1',
        name: 'Suresh Kumar',
        role: 'WAREHOUSE_STAFF',
        warehouseId: alphaHub.id
      },
      {
        email: 'staff2@alphahub.waremind.ai',
        passwordHash: 'hashed_pw_staff2',
        name: 'Rajesh Verma',
        role: 'WAREHOUSE_STAFF',
        warehouseId: alphaHub.id
      }
    ]
  });

  console.log('Creating dummy Products...');

  const s24 = await prisma.product.create({
    data: {
      sku: 'SAM-S24-ULTRA',
      name: 'Samsung Galaxy S24 Ultra',
      category: 'Electronics',
      weight: 0.232,
      dimensions: '162.3 x 79 x 8.6 mm',
      isHazardous: false,
      isTemperatureSensitive: true,
      companyId: samsung.id
    }
  });

  const airdopes = await prisma.product.create({
    data: {
      sku: 'BOAT-AD-141',
      name: 'Boat Airdopes 141',
      category: 'Electronics',
      weight: 0.05,
      dimensions: '5 x 5 x 2 cm',
      isHazardous: false,
      isTemperatureSensitive: false,
      companyId: boat.id
    }
  });

  console.log('Seeding initial Inventory items...');

  // Get first bin and second bin from Alpha Hub
  const firstBinId = alphaHub.zones[0].racks[0].shelves[0].bins[0].id;
  const secondBinId = alphaHub.zones[0].racks[0].shelves[0].bins[1].id;

  await prisma.inventory.create({
    data: {
      quantity: 500,
      arrivalDate: new Date(),
      status: 'STORED',
      productId: s24.id,
      companyId: samsung.id,
      warehouseId: alphaHub.id,
      binId: firstBinId
    }
  });

  await prisma.inventory.create({
    data: {
      quantity: 1000,
      arrivalDate: new Date(),
      status: 'STORED',
      productId: airdopes.id,
      companyId: boat.id,
      warehouseId: alphaHub.id,
      binId: secondBinId
    }
  });

  console.log('Creating Storage Requests...');

  await prisma.storageRequest.create({
    data: {
      status: 'PENDING',
      requestedPallets: 10,
      itemsDetails: [
        { sku: 'SAM-S24-ULTRA', quantity: 2000, expectedArrival: '2026-08-01' }
      ],
      companyId: samsung.id,
      warehouseId: alphaHub.id
    }
  });

  console.log('Creating Unpaid Invoice...');

  await prisma.invoice.create({
    data: {
      month: 7,
      year: 2026,
      storageCharges: 5000.00,
      handlingCharges: 1500.00,
      totalAmount: 6500.00,
      status: 'UNPAID',
      companyId: boat.id
    }
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
