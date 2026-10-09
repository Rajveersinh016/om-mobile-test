import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PRODUCTS = [
  { "id": 1, "name": "Stealth Black Skin", "price": 14.99, "originalPrice": 19.99, "category": "mobile", "brand": "Apple", "material": "Standard 3M", "finish": "Matte", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuCNxQr7LbDB90XpeIq66u1z8cx8DJZ4YwV-KFHEPbpyGwJU-xmOpBZEIJIcik9y7MX44YThGArd_8BHi42YP2I3iNu-vw5XUNXZdnrZpJnUgWjXYRQ6WpODbfW08Jp3S77XJ9i2_SmCJsjkBlo970SakiYKuNYAPLOA0l9_vf5zjDq_zg_7Lusrf3mHqmJxq--Yg8PUa8EQNkUrKhuGJNx9u9w50fPKvEwwOqGB2er3k4PuZeLfBYJe4--Up2EPJCrC5NX5mG3Objk", "description": "The ultimate stealth upgrade." },
  { "id": 2, "name": "Cyber Neon Skin", "price": 16.99, "originalPrice": 22.99, "category": "mobile", "brand": "Samsung", "material": "Standard 3M", "finish": "Gloss", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuC-GlunR3S8ZEJDtlVRksQPBMIaxVcJKdlwWMyh9TGS7lbfq2QTGzHULDLJxSBqG_2CNFcpW2r4E38LmyA0ZysKJUHmk4x0tLeSSvUny5oGePurfUbEY-njPWEs0f6icqqj9TQ1DfXL3qfymCmDl7zXEBSd7S5Z4K6iOdrYZD_tDh9GRz356odnfodol6d1lFNf4wumFIt5jc4jb4vttmAzfceyLTIqLmLB9QH9pYavwFJntfSloOmwvqpFEkTWsUui16f39nQdNRw", "description": "Shimmering futuristic look." },
  { "id": 3, "name": "Classic Marble Skin", "price": 14.99, "originalPrice": 14.99, "category": "mobile", "brand": "Google", "material": "Standard 3M", "finish": "Gloss", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuB6S3GxA1Z1wze3MP2mkuHSZiaO94nZ-E-KPeHKhMU7PU8YELjiklwr16MkQYEInfoMwFLCa7sS5MTnm9eUuyW8PHCqvrVGxtqsl8dTI0PpZd4ZMJO6K1ohUxts8EJ5YrWjR5-MkIQE0mtIvkILl3jACAf22bGArIuTPbC6kTnGbEOOamHq1mK_vqhoYYmo_oTe0Zyha1PNmZieMOFhW-kID3U9a1vqlLbBiuIiJVEesubC-V2YWRI6ThCGheDCXa7VY4Cpx9EvFX0", "description": "Elegant white marble." },
  { "id": 4, "name": "Forged Carbon Skin", "price": 18.99, "originalPrice": 24.99, "category": "mobile", "brand": "Apple", "material": "Standard 3M", "finish": "Matte", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuAccJqCkrJzAaYpo-B0G58KMceDxO3onxPjPo2eOOcqHZrN3jssx-1ydBzgi40P7mI6EIsu3U19SYP84FnAk8bxf8yg6afm07ixqlbwHpxboR1Ya9ECsguVozTlQVpSPSPCioVc7diS4m1bkdBvc3O5wu7MCWH2_OqukFzpMmWmrsqpVpzVB9BE6YGmOQteK7u3EWqnFhQ8c4_9UxyPJYesbVZJW0LJhYundApPJ50hopIZLqPDyajOE3uRU2CpDUj6aj1gonBidRM", "description": "Unique marbled carbon fiber pattern." },
  { "id": 5, "name": "Signature Leather Skin", "price": 9.99, "originalPrice": 14.99, "category": "mobile", "brand": "Apple", "material": "Leather", "finish": "Matte", "image": "https://images.unsplash.com/photo-1605405748313-a416a1b84491?q=80&w=800&auto=format&fit=crop", "description": "Hand-crafted aesthetic." },
  { "id": 6, "name": "Espresso Leather Skin", "price": 24.95, "originalPrice": 29.95, "category": "mobile", "brand": "Apple", "material": "Leather", "finish": "Matte", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuCEJpVpKZ7NnUU9uW7zqKuLHVMWKZgTNnCeukXgYeR9Yg5dj3hjaxQWMhkUgRm9IKNkEqXnmnw_lbREoURKQSRZihsdnZZLdnr0M0znZvPBSrZF8f0Obf6RYEs4K3_M4IiFE2Gs_8xw494fp7MxuiuWWbLSciwQJ3oKDF31ClCtAyU3xUqpe3Ag_RzVatwVIlY0DCK4CQKANJS1d3GvuoWiQvijJFSUu0TgO6Z_NAkH8baF0pgem0528NNXO2ulYpE8nNVKEXADABg", "description": "Rich espresso brown leather texture." },
  { "id": 7, "name": "Holographic Prism Skin", "price": 29.95, "originalPrice": 29.95, "category": "mobile", "brand": "Samsung", "material": "Standard 3M", "finish": "Gloss", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuCOYDDYcCliu5BzF9SaiQkgx83iHaNUfxKsgzGS72BiDkQgDzgrBKFYuHy0XwDoKlL7-eps1ZyVQx7mxvH6PGoYlcGnEHiV2a64HOb-4zD_-M25Fr-fLAwWgJ7VYRnT8Br6XJ5SNR5jC1s2c28ptYi9HktzpqIVDg6nsfWwF3BYXyPw1ZIb21rx47IPS-mCVrv9w3YeHcgk6Dh5VffY8D_0R4Kcu8K_wk_c4MjdAUIOPyUfqsBwTWU-qkhFM3pVQxjDktzDgqyEo8s", "description": "High-fidelity iridescent skin." },
  { "id": 8, "name": "Matte Stealth Carbon Fiber", "price": 24.95, "originalPrice": 24.95, "category": "mobile", "brand": "Google", "material": "Standard 3M", "finish": "Matte", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuAWP9Cosx1xK1DitmKfdkUJiDwA2w1e1UBTTdqz54ueHSr65jifOY8BIliLk6grM6ATzGQnWk_QlChJC8YRq2yHYQ6PTKwWigcB7jPhVuoMygAYK5dxakqe47Js3vS_3Lt28RPhItDoxXTlKxEaLNOOJ0I-7BRLmLucggqBjtYgbeFrpzupixixn_zPWIjSF5zqQtkQ0TbKJDNeidpE38jgwhyu2Q3jFN52f8oz-2p64J4Epw2aTaa9QkNv33sC0terro16eNwp4DM", "description": "Tactile woven carbon texture." },
  { "id": 9, "name": "Satin Sage Green Series", "price": 19.95, "originalPrice": 24.95, "category": "mobile", "brand": "OnePlus", "material": "Standard 3M", "finish": "Satin", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuB7ZkNoi2_GbFt0n8BK0ZYv2MPhITsd676l0CShG4IVdnRBPj_9ylAqaEuXtvwAciw3eBZ_dyb_WW1HoossNoulV1l1Sgh9BLYmNJNe3MEpcUqoWmsmEM6AczKCEPyuNc000hjlGu2wbKJj16UT6ipkKi1jS1aLZyLZurAVCWX2xGk6puu01r0YQi_9seoii6sZgDfnasFARziy1wVxdXP7usedkQpcLI8olSK_cYNp7tbpA75nejEVo8_lQRCdHooMiwOxtwDqohw", "description": "Calm, lifestyle-oriented sage green skin." },
  { "id": 10, "name": "24K Gold Flake Signature", "price": 29.95, "originalPrice": 39.95, "category": "mobile", "brand": "Apple", "material": "Standard 3M", "finish": "Gloss", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuCsa9iDUatrP4WZ23UMMs7j_57AW4UelLPe947ZkNeSmn-Enr4nowCKywrcwMY63xUmg5-DpLkNuDAzMcZ8_i0wKiW-Wm54kVUcRA-fCAEBMbynRJH8nQ0xpLlqnrtUCxt78vxUElK6HOd0ZzA9fRNbKjwpJF_sb9oIEJZ9-M_KYm6rX6-cPdh1UPF8LtiOQo3uSsWWzQmWK81P_VA1x_rcc_ufWqoAW72Tgbo_dTcOyQt36ObM-m_C2MNo6rFRVx1yvTA3nyAJGRE", "description": "Rich 24K gold flakes embedded." },
  { "id": 11, "name": "Classic Walnut Wood Skin", "price": 24.95, "originalPrice": 24.95, "category": "mobile", "brand": "Google", "material": "Wood", "finish": "Matte", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuCzrbMysSIVwrB0-qURyEg87dFxAHd1_fHMWHikxD0PfPLcOxQDfuf0-7_VeZasPYwhBeWJyXXLqszgQ5BwQG295dFVUkAvMtYtdplHIEUJ2WF1KKIzBWgyd2PNa0GRknTrkcl3WVofO1wH9QFIZ7QxScY4tZ7CS58FvB_W5pzUf9BrIz_LNHws6XKQg9l-E1dMbDeBxGIxD6SWJD6vR6R2l6VIi5hmpt_nYKeTJ-FltDIhKi5jvJKBWm83Gdw66tCaLN1gV_tYP0c", "description": "Organic walnut wood grain texture." },
  { "id": 12, "name": "Signature Carbon Fiber Skin", "price": 14.99, "originalPrice": 24.99, "category": "mobile", "brand": "Apple", "material": "Standard 3M", "finish": "Matte", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuDeG5e3L4jAoirTf-RhNIJWU2R5AAnlLY28tF1HLSkPf_hWJp9HuZZHMz8zcBQnao2FnCssidUOS0nBKzHVNmvBBnRNT5NiVBGOszXDNFg0Oe3TxlfIIF9X59v7W5BpzVg_pCojiRI6XhOmEZhz7BNRPQiTp0Dfan_bw3AKPt50irRinKfDLhDoGzQpzpTIRyd8JmiNMIyYIJgI9dO91ruawcT8R9CXRMNPQfkZARiSKK0nr81IZkf-d7GUHdiL1BM3CQ0GPRHuq6w", "description": "Elevate your device with carbon fiber." }
];

const FINISHES = ['Matte', 'Gloss', 'Satin', 'Standard'];
const MATERIALS = ['Standard 3M', 'Leather Texture', 'Brushed Metal', 'Wood', 'Standard'];

async function main() {
  console.log('Seeding Database...');

  console.log('Cleaning Product Types...');
  await prisma.productType.deleteMany();

  console.log('Seeding Product Types...');
  const productTypesToSeed = [
    { id: 'b0000000-0000-0000-0000-000000000001', name: 'Skin', slug: 'skin', sortOrder: 1, isVisible: true, isActive: true },
    { id: 'b0000000-0000-0000-0000-000000000002', name: 'Screen Lamination', slug: 'screen-lamination', sortOrder: 2, isVisible: true, isActive: true },
    { id: 'b0000000-0000-0000-0000-000000000003', name: 'Magic Glass', slug: 'magic-glass', sortOrder: 3, isVisible: true, isActive: true }
  ];

  for (const pt of productTypesToSeed) {
    await prisma.productType.upsert({
      where: { id: pt.id },
      update: {},
      create: pt
    });
  }

  console.log('Cleaning Collections...');
  await prisma.collection.deleteMany();

  console.log('Seeding Collections...');
  const defaultCollections = [
    { id: 'c0000000-0000-0000-0000-000000000001', name: 'Anime Collection', slug: 'anime', description: 'Vibrant anime-inspired designs for enthusiasts.', thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWZemF2MP94MBoM9Da5hPKQsIT9sA4Kw-eCGm_2jkW3e2lseyT3myJJvXUl6DvVdDhNXRXu2TbpcppeKwybD_4VUDSxRSPmS4wxsj76et2SLDtDJspAprAHPhg0p1EDRP873BilOjXHzddxHjgWbNUDIwdXZKFfHrq7R4NQMr8V9QgPoz9rNtDZaUShvwpUhLHUzSUFT2-pDqNZEVNww6BuOsooDLaXxEsLtLlD-AMTqsUKzd1OPf-LgHqjzjNqbpTpwye8m1sVwA', sortOrder: 1, isActive: true, isVisible: true, isFeatured: true, theme: 'anime', desktopBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWZemF2MP94MBoM9Da5hPKQsIT9sA4Kw-eCGm_2jkW3e2lseyT3myJJvXUl6DvVdDhNXRXu2TbpcppeKwybD_4VUDSxRSPmS4wxsj76et2SLDtDJspAprAHPhg0p1EDRP873BilOjXHzddxHjgWbNUDIwdXZKFfHrq7R4NQMr8V9QgPoz9rNtDZaUShvwpUhLHUzSUFT2-pDqNZEVNww6BuOsooDLaXxEsLtLlD-AMTqsUKzd1OPf-LgHqjzjNqbpTpwye8m1sVwA', mobileBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWZemF2MP94MBoM9Da5hPKQsIT9sA4Kw-eCGm_2jkW3e2lseyT3myJJvXUl6DvVdDhNXRXu2TbpcppeKwybD_4VUDSxRSPmS4wxsj76et2SLDtDJspAprAHPhg0p1EDRP873BilOjXHzddxHjgWbNUDIwdXZKFfHrq7R4NQMr8V9QgPoz9rNtDZaUShvwpUhLHUzSUFT2-pDqNZEVNww6BuOsooDLaXxEsLtLlD-AMTqsUKzd1OPf-LgHqjzjNqbpTpwye8m1sVwA' },
    { id: 'c0000000-0000-0000-0000-000000000002', name: 'Marvel Edition', slug: 'marvel', description: 'Heroic Marvel-inspired designs with premium finishes.', thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYnPO-qED1PlSChAUTvBxzzE0ZSHz4uKkPUeahVzDftVi2s2RRI2Z5KUzQhvmjwrYS0celseczhC8vtZ-GCKTiFvPys52OtMDRG6LNfLp36QVjVdpJG4Dh0ejKgIdkINidq56I6JbD0KJ5gGDeN5O6nLJcbHRLka7jOHIGqQkTpvkgEOTaJePNydQSFhJCgoEkM-L2FGM6EGjThAO3J8DbLjWZ7CTR-9AFclHhBP5-oYVnCgDFDfzOXRBX6JlblaWUR_VF4K4lhvI', sortOrder: 2, isActive: true, isVisible: true, isFeatured: true, theme: 'marvel', desktopBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYnPO-qED1PlSChAUTvBxzzE0ZSHz4uKkPUeahVzDftVi2s2RRI2Z5KUzQhvmjwrYS0celseczhC8vtZ-GCKTiFvPys52OtMDRG6LNfLp36QVjVdpJG4Dh0ejKgIdkINidq56I6JbD0KJ5gGDeN5O6nLJcbHRLka7jOHIGqQkTpvkgEOTaJePNydQSFhJCgoEkM-L2FGM6EGjThAO3J8DbLjWZ7CTR-9AFclHhBP5-oYVnCgDFDfzOXRBX6JlblaWUR_VF4K4lhvI', mobileBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYnPO-qED1PlSChAUTvBxzzE0ZSHz4uKkPUeahVzDftVi2s2RRI2Z5KUzQhvmjwrYS0celseczhC8vtZ-GCKTiFvPys52OtMDRG6LNfLp36QVjVdpJG4Dh0ejKgIdkINidq56I6JbD0KJ5gGDeN5O6nLJcbHRLka7jOHIGqQkTpvkgEOTaJePNydQSFhJCgoEkM-L2FGM6EGjThAO3J8DbLjWZ7CTR-9AFclHhBP5-oYVnCgDFDfzOXRBX6JlblaWUR_VF4K4lhvI' },
    { id: 'c0000000-0000-0000-0000-000000000003', name: 'Gaming Gear', slug: 'gaming', description: 'Cyberpunk and gaming-themed neon skins.', thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0PbpLjMq9NmPJL3YlGG_bakeGffy52nituv8DUQzUt1tTc_0hNduuk4VJI1gt8l9FeIGv1KLILZdeWv3gn5f7hl81sqlk4Q7NMRs7fg7G_M6_Q0CTPCtV24np0xfz5VUXCHLhHTXi8EqjjbylMeRmPHE5-ahjp0R_qbVR5_MnSpABd3nsLKBm3IUVgTV1Uq1SojhfiBIYZIosqAoArDPSjeDTCqcGtMrFd-CukY8MxRAMKyrm5fP7XHrof1bNFeJNPf7xAwC2EI0', sortOrder: 3, isActive: true, isVisible: true, isFeatured: true, theme: 'gaming', desktopBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0PbpLjMq9NmPJL3YlGG_bakeGffy52nituv8DUQzUt1tTc_0hNduuk4VJI1gt8l9FeIGv1KLILZdeWv3gn5f7hl81sqlk4Q7MAGNET-Ttc-g', mobileBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0PbpLjMq9NmPJL3YlGG_bakeGffy52nituv8DUQzUt1tTc_0hNduuk4VJI1gt8l9FeIGv1KLILZdeWv3gn5f7hl81sqlk4Q7MAGNET-Ttc-g' },
    { id: 'c0000000-0000-0000-0000-000000000004', name: 'Nature Series', slug: 'nature', description: 'Organic textures: marble, wood, and nature-inspired.', thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDUAr8QecGtUiFufrNv4A-cFZEcDq9C6brYs9yUc8mD7tWHFCzZSl-jmdRmtHpS2eIxYeEaL9iLf55v1e8afKwhmbtWLEvS6ow7KtIo0E8KlOeAD8zds3zONzkt_9MDC-L_VCSaOPH_p999h1ievpzaHLo1h43ye072lcmqOg3menlC0IrsO6fxMvniAp1NLw6qPFIJgbMb8YNP_Tt7IWk85PdXwB1DTlCsIbicUroIbcydsSnOAXsOc95_GV5rFslDxheQIcEp4_c', sortOrder: 4, isActive: true, isVisible: true, isFeatured: true, theme: 'nature', desktopBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDUAr8QecGtUiFufrNv4A-cFZEcDq9C6brYs9yUc8mD7tWHFCzZSl-jmdRmtHpS2eIxYeEaL9iLf55v1e8afKwhmbtWLEvS6ow7KtIo0E8KlOeAD8zds3zONzkt_9MDC-L_VCSaOPH_p999h1ievpzaHLo1h43ye072lcmqOg3menlC0IrsO6fxMvniAp1NLw6qPFIJgbMb8YNP_Tt7IWk85PdXwB1DTlCsIbicUroIbcydsSnOAXsOc95_GV5rFslDxheQIcEp4_c', mobileBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDUAr8QecGtUiFufrNv4A-cFZEcDq9C6brYs9yUc8mD7tWHFCzZSl-jmdRmtHpS2eIxYeEaL9iLf55v1e8afKwhmbtWLEvS6ow7KtIo0E8KlOeAD8zds3zONzkt_9MDC-L_VCSaOPH_p999h1ievpzaHLo1h43ye072lcmqOg3menlC0IrsO6fxMvniAp1NLw6qPFIJgbMb8YNP_Tt7IWk85PdXwB1DTlCsIbicUroIbcydsSnOAXsOc95_GV5rFslDxheQIcEp4_c' },
    { id: 'c0000000-0000-0000-0000-000000000005', name: 'God Collection', slug: 'gods', description: 'Mythological gold-on-black ethereal designs.', thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD-V--0Nmn23T77DNjV7BMs8ft_JFe9evlZt33BQSwhJyOR5IXpIfAXtvsP5pL0w1UBiIHauC5TeyMhu_82fRRL164vmtO33SZX7G4kchHtpzQbvjEW267xV0fr_5AgKRVYwATL8PedzngSrGoqZb5JHZSLfynxeXxjmOslJktvj_vwGNmiUq2fBC_B2XO3X1HO5gq1ravIR7K0E-HQTvmij-1KmyXQiUu5nU1xW82oOM7tBlY6RyfOVHBhkKk9km3xCQbHrtLWqxk', sortOrder: 5, isActive: true, isVisible: true, isFeatured: true, theme: 'gods', desktopBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD-V--0Nmn23T77DNjV7BMs8ft_JFe9evlZt33BQSwhJyOR5IXpIfAXtvsP5pL0w1UBiIHauC5TeyMhu_82fRRL164vmtO33SZX7G4kchHtpzQbvjEW267xV0fr_5AgKRVYwATL8PedzngSrGoqZb5JHZSLfynxeXxjmOslJktvj_vwGNmiUq2fBC_B2XO3X1HO5gq1ravIR7K0E-HQTvmij-1KmyXQiUu5nU1xW82oOM7tBlY6RyfOVHBhkKk9km3xCQbHrtLWqxk', mobileBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD-V--0Nmn23T77DNjV7BMs8ft_JFe9evlZt33BQSwhJyOR5IXpIfAXtvsP5pL0w1UBiIHauC5TeyMhu_82fRRL164vmtO33SZX7G4kchHtpzQbvjEW267xV0fr_5AgKRVYwATL8PedzngSrGoqZb5JHZSLfynxeXxjmOslJktvj_vwGNmiUq2fBC_B2XO3X1HO5gq1ravIR7K0E-HQTvmij-1KmyXQiUu5nU1xW82oOM7tBlY6RyfOVHBhkKk9km3xCQbHrtLWqxk' },
    { id: 'c0000000-0000-0000-0000-000000000006', name: 'Carbon Fiber', slug: 'carbon', description: 'Industrial carbon fiber precision aesthetics.', thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAv3rLo5iLG3BkwTB6bd5h45wl3k20_Yh-ObG-kbCv0WChfhNAeHKmsCwQLcFOmu3mAfCdpWX3mEEgzSPPE75ckkAdlTQRTohxOfDpxgyynrpDH19a43Ci42B11nCAVRUyqbVyOpOX8xn2NxmO2M9dGGaatsJ8DJiKx1-VSXQjDb2TOW6b-r5udQal21I7sj4l3rTA0rITuBYQaKeElRylNc2eSdvsqyZjrGb_pl7w2cB-gJ61Q0aFe0i-8xxZU80sHSpMl8MhrfA', sortOrder: 6, isActive: true, isVisible: true, isFeatured: true, theme: 'carbon', desktopBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAv3rLo5iLG3BkwTB6bd5h45wl3k20_Yh-ObG-kbCv0WChfhNAeHKmsCwQLcFOmu3mAfCdpWX3mEEgzSPPE75ckkAdlTQRTohxOfDpxgyynrpDH19a43Ci42B11nCAVRUyqbVyOpOX8xn2NxmO2M9dGGaatsJ8DJiKx1-VSXQjDb2TOW6b-r5udQal21I7sj4l3rTA0rITuBYQaKeElRylNc2eSdvsqyZjrGb_pl7w2cB-gJ61Q0aFe0i-8xxZU80sHSpMl8MhrfA', mobileBanner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAv3rLo5iLG3BkwTB6bd5h45wl3k20_Yh-ObG-kbCv0WChfhNAeHKmsCwQLcFOmu3mAfCdpWX3mEEgzSPPE75ckkAdlTQRTohxOfDpxgyynrpDH19a43Ci42B11nCAVRUyqbVyOpOX8xn2NxmO2M9dGGaatsJ8DJiKx1-VSXQjDb2TOW6b-r5udQal21I7sj4l3rTA0rITuBYQaKeElRylNc2eSdvsqyZjrGb_pl7w2cB-gJ61Q0aFe0i-8xxZU80sHSpMl8MhrfA' },
    { id: 'c0000000-0000-0000-0000-000000000007', name: 'Luxury Series', slug: 'luxury', description: 'Exquisite textures crafted for premium look and feel.', thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop', sortOrder: 7, isActive: true, isVisible: true, isFeatured: true, theme: 'luxury', desktopBanner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop', mobileBanner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop' },
    { id: 'c0000000-0000-0000-0000-000000000008', name: 'Minimalist Solid', slug: 'minimal', description: 'Pure solid tones and minimal pastel textures.', thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop', sortOrder: 8, isActive: true, isVisible: true, isFeatured: true, theme: 'minimal', desktopBanner: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop', mobileBanner: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop' },
    { id: 'c0000000-0000-0000-0000-000000000009', name: 'Sports League', slug: 'sports', description: 'Athletic and high-adrenaline team spirit designs.', thumbnail: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop', sortOrder: 9, isActive: true, isVisible: true, isFeatured: true, theme: 'sports', desktopBanner: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop', mobileBanner: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop' },
    { id: 'c0000000-0000-0000-0000-000000000010', name: 'Festival Special', slug: 'festival', description: 'Colorful cultural drops celebrating global festivals.', thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop', sortOrder: 10, isActive: true, isVisible: true, isFeatured: true, theme: 'festival', desktopBanner: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop', mobileBanner: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop' }
  ];

  for (const col of defaultCollections) {
    await prisma.collection.upsert({
      where: { id: col.id },
      update: {},
      create: col
    });
  }

  // Create default categories
  const categoriesToSeed = [
    { id: 'a0000000-0000-0000-0000-000000000000', name: 'Camera Skins', slug: 'camera' },
    { id: 'a0000000-0000-0000-0000-000000000010', name: 'Camera Lens Skins', slug: 'camera-lens' },
    { id: 'a0000000-0000-0000-0000-000000000001', name: 'Mobile Skins', slug: 'mobile' },
    { id: 'a0000000-0000-0000-0000-000000000002', name: 'Laptop Skins', slug: 'laptop' }
  ];

  for (const cat of categoriesToSeed) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug
      }
    });
  }

  // Create products and variants
  for (const p of DEFAULT_PRODUCTS) {
    const productUuid = `10000000-0000-0000-0000-${String(p.id).padStart(12, '0')}`;
    
    await prisma.product.upsert({
      where: { id: productUuid },
      update: {
        productTypeId: 'b0000000-0000-0000-0000-000000000001',
      },
      create: {
        id: productUuid,
        name: p.name,
        slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: p.description,
        price: p.price,
        originalPrice: p.originalPrice,
        image: p.image,
        categoryId: 'a0000000-0000-0000-0000-000000000001',
        productTypeId: 'b0000000-0000-0000-0000-000000000001',
        isPublished: true,
      },
    });

    // Create combinations of variants
    let variantIndex = 1;
    for (const f of FINISHES) {
      for (const m of MATERIALS) {
        const variantUuid = `20000000-0000-0000-${String(p.id).padStart(4, '0')}-${String(variantIndex).padStart(12, '0')}`;
        const sku = `SKU-P${p.id}-${f.substring(0, 3).toUpperCase()}-${m.substring(0, 3).toUpperCase()}`;

        await prisma.productVariant.upsert({
          where: { sku },
          update: {},
          create: {
            id: variantUuid,
            productId: productUuid,
            sku,
            finish: f,
            material: m,
            priceOffset: 0.0,
            stockQuantity: 100,
          },
        });
        variantIndex++;
      }
    }
  }

  // --- Seed Homepage Sections ---
  console.log('Seeding Homepage Sections...');
  const defaultSections = [
    {
      sectionKey: 'announcement_bar',
      displayName: 'Announcement Bar',
      position: 1,
      isActive: true,
      settings: {
        text: 'FREE SHIPPING ON ORDERS OVER ₹999! SHOP PREMIUM SKINS NOW.',
        link: '/shop/pages/shop.html',
        bgColor: '#9b4000',
        textColor: '#ffffff'
      }
    },
    {
      sectionKey: 'hero',
      displayName: 'Hero Slider',
      position: 2,
      isActive: true,
      settings: {}
    },
    {
      sectionKey: 'categories',
      displayName: 'Shop By Category',
      position: 3,
      isActive: true,
      settings: {
        showProductCount: true,
        featuredCategories: [
          { id: 'a0000000-0000-0000-0000-000000000000', name: 'Camera Skins', displayName: 'Camera Skins', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=400&auto=format&fit=crop', position: 1, isActive: true, isNew: false, isTrending: false },
          { id: 'a0000000-0000-0000-0000-000000000001', name: 'Mobile Skins', displayName: 'Mobile Skins', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIl1RY-CFqKqlm20yFwDzmVwT8vlSrbdyQ4pmXIcjPhMMzNsEESP0SOG1CUGHfTgyb9L3GsJm_KV_ddPfK-dEzPHx3MPmvNqFn9MBCW-gN14pseXuqL8CuGvVPUDwabpuQ4J9-kuKV9EA6cCMsJfI0fRzorWpP4o5hxrl28wT3mHmxf1MGR2FDz27fHVTe6Fj9VCWilv_R_9B-ZHPy611VTTP6amL6p6hMCzB0oxa9w_0fhWJ39KuE0zvetNA6NCWI-27nHBbqPGU', position: 2, isActive: true, isNew: false, isTrending: false },
          { id: 'a0000000-0000-0000-0000-000000000002', name: 'Laptop Skins', displayName: 'Laptop Skins', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAv3rLo5iLG3BkwTB6bd5h45wl3k20_Yh-ObG-kbCv0WChfhNAeHKmsCwQLcFOmu3mAfCdpWX3mEEgzSPPE75ckkAdlTQRTohxOfDpxgyynrpDH19a43Ci42B11nCAVRUyqbVyOpOX8xn2NxmO2M9dGGaatsJ8DJiKx1-VSXQjDb2TOW6b-r5udQal21I7sj4l3rTA0rITuBYQaKeElRylNc2eSdvsqyZjrGb_pl7w2cB-gJ61Q0aFe0i-8xxZU80sHSpMl8MhrfA', position: 3, isActive: true, isNew: false, isTrending: false },
          { id: 'a0000000-0000-0000-0000-000000000003', name: 'Tablet Skins', displayName: 'Tablet Skins', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDUAr8QecGtUiFufrNv4A-cFZEcDq9C6brYs9yUc8mD7tWHFCzZSl-jmdRmtHpS2eIxYeEaL9iLf55v1e8afKwhmbtWLEvS6ow7KtIo0E8KlOeAD8zds3zONzkt_9MDC-L_VCSaOPH_p999h1ievpzaHLo1h43ye072lcmqOg3menlC0IrsO6fxMvniAp1NLw6qPFIJgbMb8YNP_Tt7IWk85PdXwB1DTlCsIbicUroIbcydsSnOAXsOc95_GV5rFslDxheQIcEp4_c', position: 4, isActive: true, isNew: false, isTrending: false },
          { id: 'a0000000-0000-0000-0000-000000000004', name: 'Watch Skins', displayName: 'Watch Skins', image: 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?q=80&w=400&auto=format&fit=crop', position: 5, isActive: true, isNew: false, isTrending: false },
          { id: 'a0000000-0000-0000-0000-000000000005', name: 'AirPods Skins', displayName: 'AirPods Skins', image: 'https://images.unsplash.com/photo-1588449668365-d15e397f6787?q=80&w=400&auto=format&fit=crop', position: 6, isActive: true, isNew: false, isTrending: false },
          { id: 'a0000000-0000-0000-0000-000000000006', name: 'Gaming Console', displayName: 'Gaming Console', image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?q=80&w=400&auto=format&fit=crop', position: 7, isActive: true, isNew: false, isTrending: false },
          { id: 'a0000000-0000-0000-0000-000000000007', name: 'Card Skins', displayName: 'Card Skins', image: 'https://images.unsplash.com/photo-1589758438368-0ad531db3366?q=80&w=400&auto=format&fit=crop', position: 8, isActive: true, isNew: false, isTrending: false },
          { id: 'a0000000-0000-0000-0000-000000000008', name: 'Custom Print', displayName: 'Custom Print', image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=400&auto=format&fit=crop', position: 9, isActive: true, isNew: false, isTrending: false, link: 'custom_skin.html' }
        ]
      }
    },
    {
      sectionKey: 'brands',
      displayName: 'Browse By Brand',
      position: 4,
      isActive: false,
      settings: {
        featuredBrands: [
          { name: 'Apple', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg', position: 1, isActive: true, supportedDevicesCount: 42 },
          { name: 'Samsung', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg', position: 2, isActive: true, supportedDevicesCount: 35 },
          { name: 'Google', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg', position: 3, isActive: true, supportedDevicesCount: 18 },
          { name: 'Nothing', logo: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Nothing_Logo.svg', position: 4, isActive: true, supportedDevicesCount: 6 },
          { name: 'OnePlus', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/09/OnePlus_logo.svg', position: 5, isActive: true, supportedDevicesCount: 12 }
        ]
      }
    },
    {
      sectionKey: 'collections',
      displayName: 'Featured Collections',
      position: 5,
      isActive: true,
      settings: {
        featuredCollections: [
          { name: 'Anime Collection', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWZemF2MP94MBoM9Da5hPKQsIT9sA4Kw-eCGm_2jkW3e2lseyT3myJJvXUl6DvVdDhNXRXu2TbpcppeKwybD_4VUDSxRSPmS4wxsj76et2SLDtDJspAprAHPhg0p1EDRP873BilOjXHzddxHjgWbNUDIwdXZKFfHrq7R4NQMr8V9QgPoz9rNtDZaUShvwpUhLHUzSUFT2-pDqNZEVNww6BuOsooDLaXxEsLtLlD-AMTqsUKzd1OPf-LgHqjzjNqbpTpwye8m1sVwA', ctaText: 'Explore Collection', position: 1, isActive: true, link: '/shop/pages/shop.html?collection=Anime' },
          { name: 'Marvel Edition', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYnPO-qED1PlSChAUTvBxzzE0ZSHz4uKkPUeahVzDftVi2s2RRI2Z5KUzQhvmjwrYS0celseczhC8vtZ-GCKTiFvPys52OtMDRG6LNfLp36QVjVdpJG4Dh0ejKgIdkINidq56I6JbD0KJ5gGDeN5O6nLJcbHRLka7jOHIGqQkTpvkgEOTaJePNydQSFhJCgoEkM-L2FGM6EGjThAO3J8DbLjWZ7CTR-9AFclHhBP5-oYVnCgDFDfzOXRBX6JlblaWUR_VF4K4lhvI', ctaText: 'Explore Collection', position: 2, isActive: true, link: '/shop/pages/shop.html?collection=Marvel' },
          { name: 'Carbon Fiber', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAv3rLo5iLG3BkwTB6bd5h45wl3k20_Yh-ObG-kbCv0WChfhNAeHKmsCwQLcFOmu3mAfCdpWX3mEEgzSPPE75ckkAdlTQRTohxOfDpxgyynrpDH19a43Ci42B11nCAVRUyqbVyOpOX8xn2NxmO2M9dGGaatsJ8DJiKx1-VSXQjDb2TOW6b-r5udQal21I7sj4l3rTA0rITuBYQaKeElRylNc2eSdvsqyZjrGb_pl7w2cB-gJ61Q0aFe0i-8xxZU80sHSpMl8MhrfA', ctaText: 'Explore Collection', position: 3, isActive: true, link: '/shop/pages/shop.html?collection=Carbon' }
        ]
      }
    },
    {
      sectionKey: 'trending',
      displayName: 'Trending Designs',
      position: 6,
      isActive: true,
      settings: {
        mode: 'auto',
        productIds: [],
        limit: 4
      }
    },
    {
      sectionKey: 'best_sellers',
      displayName: 'Best Sellers',
      position: 7,
      isActive: true,
      settings: {
        mode: 'auto',
        productIds: [],
        limit: 4
      }
    },
    {
      sectionKey: 'new_arrivals',
      displayName: 'New Arrivals',
      position: 8,
      isActive: true,
      settings: {
        mode: 'auto',
        productIds: [],
        limit: 4
      }
    },
    {
      sectionKey: 'custom_print',
      displayName: 'Custom Print Banner',
      position: 9,
      isActive: true,
      settings: {
        title: 'CUSTOM PRINT SKINS',
        description: 'Upload your own images, logos, or patterns and build a 100% custom mobile skin tailored precisely to your device.',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIl1RY-CFqKqlm20yFwDzmVwT8vlSrbdyQ4pmXIcjPhMMzNsEESP0SOG1CUGHfTgyb9L3GsJm_KV_ddPfK-dEzPHx3MPmvNqFn9MBCW-gN14pseXuqL8CuGvVPUDwabpuQ4J9-kuKV9EA6cCMsJfI0fRzorWpP4o5hxrl28wT3mHmxf1MGR2FDz27fHVTe6Fj9VCWilv_R_9B-ZHPy611VTTP6amL6p6hMCzB0oxa9w_0fhWJ39KuE0zvetNA6NCWI-27nHBbqPGU',
        ctaText: 'Create Your Design',
        ctaLink: '/shop/pages/custom_skin.html'
      }
    },
    {
      sectionKey: 'why_choose_us',
      displayName: 'Why Choose Us',
      position: 10,
      isActive: true,
      settings: {
        items: [
          { title: 'Premium Materials', description: 'Authentic 3M vinyl textures providing ultimate style and bubble-free install.', icon: 'shield', position: 1 },
          { title: 'Precision Cut', description: 'Meticulously measured to 0.01mm for precise wrap-around fit.', icon: 'precision_manufacturing', position: 2 },
          { title: 'Bubble-Free', description: 'Innovative micro-channels let air out for effortless application.', icon: 'air_purifier', position: 3 },
          { title: 'Easy Returns', description: 'Not satisfied? Return within 15 days, no questions asked.', icon: 'verified', position: 4 }
        ]
      }
    },
    {
      sectionKey: 'testimonials',
      displayName: 'Customer Reviews',
      position: 11,
      isActive: true,
      settings: {
        items: [
          { id: '1', name: 'David K.', review: 'The fit is absolutely perfect. I\'ve tried other brands but the texture and precision of OM Mobile Art is on another level. Highly recommended!', rating: 5, image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop', position: 1 },
          { id: '2', name: 'Sarah M.', review: 'Installation was surprisingly easy. No bubbles at all. The God Collection design looks incredible in person—very premium finish.', rating: 5, image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop', position: 2 },
          { id: '3', name: 'James L.', review: 'Fast shipping and the packaging was great. The skin has a nice grip that isn\'t slippery. Will definitely be buying more.', rating: 5, image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop', position: 3 }
        ]
      }
    },
    {
      sectionKey: 'instagram',
      displayName: 'Instagram Gallery',
      position: 12,
      isActive: true,
      settings: {
        items: [
          { image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop', link: 'https://instagram.com', position: 1 },
          { image: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?q=80&w=800&auto=format&fit=crop', link: 'https://instagram.com', position: 2 },
          { image: 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?q=80&w=800&auto=format&fit=crop', link: 'https://instagram.com', position: 3 },
          { image: 'https://images.unsplash.com/photo-1523206489230-c012c64b2b48?q=80&w=800&auto=format&fit=crop', link: 'https://instagram.com', position: 4 },
          { image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=800&auto=format&fit=crop', link: 'https://instagram.com', position: 5 },
          { image: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?q=80&w=800&auto=format&fit=crop', link: 'https://instagram.com', position: 6 }
        ]
      }
    },
    {
      sectionKey: 'newsletter',
      displayName: 'Newsletter Section',
      position: 13,
      isActive: true,
      settings: {
        title: 'Join the Community',
        description: 'Subscribe to get early access to new collection drops, exclusive offers, and styling tips.',
        bgImage: '',
        buttonText: 'Subscribe'
      }
    },
    {
      sectionKey: 'badges',
      displayName: 'Global Badges Settings',
      position: 14,
      isActive: true,
      settings: {
        badges: [
          { key: 'new', label: 'New', color: '#111111', isActive: true },
          { key: 'trending', label: 'Trending', color: '#E8660A', isActive: true },
          { key: 'bestseller', label: 'Best Seller', color: '#E8660A', isActive: true },
          { key: 'premium', label: 'Premium', color: '#9b4000', isActive: true },
          { key: 'limited', label: 'Limited Edition', color: '#ba1a1a', isActive: true },
          { key: 'sale', label: 'Sale', color: '#E8660A', isActive: true }
        ]
      }
    }
  ];

  for (const sec of defaultSections) {
    await prisma.homepageSection.upsert({
      where: { sectionKey: sec.sectionKey },
      update: {},
      create: {
        sectionKey: sec.sectionKey,
        displayName: sec.displayName,
        position: sec.position,
        isActive: sec.isActive,
        settings: sec.settings
      }
    });
  }

  // --- Seed Banners ---
  console.log('Seeding Banners...');
  const defaultBanners = [
    {
      id: 'e0000000-0000-0000-0000-000000000001',
      title: 'Protect Your Phone. Show Your Style.',
      subtitle: 'Ultra-thin, precision-cut 3M skins designed to keep your device looking flawless while expressing your unique aesthetic.',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIl1RY-CFqKqlm20yFwDzmVwT8vlSrbdyQ4pmXIcjPhMMzNsEESP0SOG1CUGHfTgyb9L3GsJm_KV_ddPfK-dEzPHx3MPmvNqFn9MBCW-gN14pseXuqL8CuGvVPUDwabpuQ4J9-kuKV9EA6cCMsJfI0fRzorWpP4o5hxrl28wT3mHmxf1MGR2FDz27fHVTe6Fj9VCWilv_R_9B-ZHPy611VTTP6amL6p6hMCzB0oxa9w_0fhWJ39KuE0zvetNA6NCWI-27nHBbqPGU',
      mobileImageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIl1RY-CFqKqlm20yFwDzmVwT8vlSrbdyQ4pmXIcjPhMMzNsEESP0SOG1CUGHfTgyb9L3GsJm_KV_ddPfK-dEzPHx3MPmvNqFn9MBCW-gN14pseXuqL8CuGvVPUDwabpuQ4J9-kuKV9EA6cCMsJfI0fRzorWpP4o5hxrl28wT3mHmxf1MGR2FDz27fHVTe6Fj9VCWilv_R_9B-ZHPy611VTTP6amL6p6hMCzB0oxa9w_0fhWJ39KuE0zvetNA6NCWI-27nHBbqPGU',
      ctaText: 'Shop Now',
      linkUrl: 'shop.html',
      isActive: true,
      position: 1
    },
    {
      id: 'e0000000-0000-0000-0000-000000000002',
      title: 'Carbon Fiber Series',
      subtitle: 'Modern raw weave patterns providing ultimate style, tactile feedback, and scratch resistance.',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAv3rLo5iLG3BkwTB6bd5h45wl3k20_Yh-ObG-kbCv0WChfhNAeHKmsCwQLcFOmu3mAfCdpWX3mEEgzSPPE75ckkAdlTQRTohxOfDpxgyynrpDH19a43Ci42B11nCAVRUyqbVyOpOX8xn2NxmO2M9dGGaatsJ8DJiKx1-VSXQjDb2TOW6b-r5udQal21I7sj4l3rTA0rITuBYQaKeElRylNc2eSdvsqyZjrGb_pl7w2cB-gJ61Q0aFe0i-8xxZU80sHSpMl8MhrfA',
      mobileImageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAv3rLo5iLG3BkwTB6bd5h45wl3k20_Yh-ObG-kbCv0WChfhNAeHKmsCwQLcFOmu3mAfCdpWX3mEEgzSPPE75ckkAdlTQRTohxOfDpxgyynrpDH19a43Ci42B11nCAVRUyqbVyOpOX8xn2NxmO2M9dGGaatsJ8DJiKx1-VSXQjDb2TOW6b-r5udQal21I7sj4l3rTA0rITuBYQaKeElRylNc2eSdvsqyZjrGb_pl7w2cB-gJ61Q0aFe0i-8xxZU80sHSpMl8MhrfA',
      ctaText: 'Explore Collections',
      linkUrl: 'collections.html',
      isActive: true,
      position: 2
    }
  ];

  for (const ban of defaultBanners) {
    await prisma.banner.upsert({
      where: { id: ban.id },
      update: {},
      create: {
        id: ban.id,
        title: ban.title,
        subtitle: ban.subtitle,
        imageUrl: ban.imageUrl,
        mobileImageUrl: ban.mobileImageUrl,
        ctaText: ban.ctaText,
        linkUrl: ban.linkUrl,
        isActive: ban.isActive,
        position: ban.position
      }
    });
  }

  // Seed default CustomSkinConfig
  console.log('Seeding CustomSkinConfig...');
  await prisma.customSkinConfig.upsert({
    where: { key: 'default' },
    update: {},
    create: {
      key: 'default',
      settings: {
        basePrice: 300,
        backPanelBasePrice: 300,
        laptopBackBasePrice: 500,
        backPanelEnabled: true,
        laptopBackEnabled: true,
        maxUploadSize: 10,
        recommendedResolution: "1200x2400",
        heroTitle: "Design Your Custom Skin",
        heroSubtitle: "Upload your favorite photos, artwork, logo or design and create a premium precision-cut skin for your device.",
        benefits: ["Bubble Free Installation", "Premium Vinyl", "Scratch Resistant", "Precision Cut", "Residue Free Removal"],
        faqs: [
          { "q": "How does the custom skin fit?", "a": "Each skin is precision-cut to fit your specific device model perfectly, leaving safe cutouts for buttons, logos, and camera bumps." },
          { "q": "Does it leave any residue when removed?", "a": "No, we use premium imported 3M vinyl which ensures bubble-free installation and completely residue-free removal." },
          { "q": "What is the recommended resolution for uploads?", "a": "For the best print results, we recommend uploading high-quality JPEGs, PNGs, or WEBP images with a resolution of at least 1200x2400 pixels." }
        ],
        helpLinks: { "chatLink": "#chat", "guideLink": "#guide", "templateLink": "#template", "guidelinesLink": "#guidelines" },
        instructionTexts: {
          "step1": "Choose Device Category to begin your design.",
          "step2": "Select your brand to explore supported device lines.",
          "step3": "Select your series class.",
          "step4": "Pick your exact device model for the camera bump template.",
          "step5": "Upload your high-res design.",
          "step6": "Adjust your design scaling, rotations, flips, and overlay grids.",
          "step7": "Preview and checkout."
        },
        warningMessages: {
          "lowQualityWarning": "Warning: Your image resolution seems low. For best print results, use a higher resolution image.",
          "sizeWarning": "Warning: File size exceeds the maximum upload limit."
        },
        sampleGallery: [
          "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=400&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?q=80&w=400&auto=format&fit=crop"
        ],
        devices: [
          {
            "category": "Mobile",
            "brand": "Apple",
            "series": "iPhone 16 Series",
            "model": "iPhone 16 Pro Max",
            "cameraBump": "apple",
            "extraCharge": 50.0,
            "stockStatus": "In Stock",
            "estimatedDispatch": "Dispatched in 24 hours"
          },
          {
            "category": "Mobile",
            "brand": "Samsung",
            "series": "Galaxy S24 Series",
            "model": "Samsung Galaxy S24 Ultra",
            "cameraBump": "samsung",
            "extraCharge": 60.0,
            "stockStatus": "In Stock",
            "estimatedDispatch": "Dispatched in 24 hours"
          },
          {
            "category": "Mobile",
            "brand": "Google",
            "series": "Pixel 8 Series",
            "model": "Google Pixel 8 Pro",
            "cameraBump": "google",
            "extraCharge": 40.0,
            "stockStatus": "In Stock",
            "estimatedDispatch": "Dispatched in 48 hours"
          },
          {
            "category": "Mobile",
            "brand": "Nothing",
            "series": "Nothing Phone 2",
            "model": "Nothing Phone 2",
            "cameraBump": "nothing",
            "extraCharge": 30.0,
            "stockStatus": "In Stock",
            "estimatedDispatch": "Dispatched in 24 hours"
          }
        ],
        materials: [
          { "name": "Premium Printable 3M Vinyl", "slug": "3m-vinyl", "extraCharge": 0.0, "isActive": true },
          { "name": "Matte Textured Vinyl", "slug": "matte-textured", "extraCharge": 50.0, "isActive": true },
          { "name": "Gloss Shimmer Vinyl", "slug": "gloss-shimmer", "extraCharge": 70.0, "isActive": true }
        ],
        finishes: [
          { "name": "Matte Finish", "slug": "matte", "extraCharge": 0.0, "isActive": true },
          { "name": "Gloss Finish", "slug": "gloss", "extraCharge": 30.0, "isActive": true },
          { "name": "Satin Finish", "slug": "satin", "extraCharge": 40.0, "isActive": true },
          { "name": "Carbon Fiber Texture", "slug": "carbon-fiber", "extraCharge": 100.0, "isActive": true },
          { "name": "Leather Texture", "slug": "leather", "extraCharge": 120.0, "isActive": true }
        ],
        coverages: [
          { "name": "Back Only", "slug": "back-only", "extraCharge": 0.0, "isActive": true },
          { "name": "Full Wrap (Includes Sides)", "slug": "full-wrap", "extraCharge": 150.0, "isActive": true }
        ]
      }
    }
  });

  console.log('Cleaning DeviceTypes, Materials, Finishes, Brand/Series/Model data...');
  await prisma.devicePreviewImage.deleteMany();
  await prisma.materialFinish.deleteMany();
  await prisma.material.deleteMany();
  await prisma.finish.deleteMany();
  await prisma.model.deleteMany();
  await prisma.series.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.deviceType.deleteMany();

  console.log('Seeding DeviceTypes...');
  const mobileDevType = await prisma.deviceType.create({
    data: { id: 'd0000000-0000-0000-0000-000000000001', name: 'Mobile', slug: 'mobile', icon: 'smartphone', sortOrder: 1 }
  });
  const tabletDevType = await prisma.deviceType.create({
    data: { id: 'd0000000-0000-0000-0000-000000000002', name: 'Tablet', slug: 'tablet', icon: 'tablet', sortOrder: 2 }
  });
  const laptopDevType = await prisma.deviceType.create({
    data: { id: 'd0000000-0000-0000-0000-000000000003', name: 'Laptop', slug: 'laptop', icon: 'laptop', sortOrder: 3 }
  });
  const cameraDevType = await prisma.deviceType.create({
    data: { id: 'd0000000-0000-0000-0000-000000000004', name: 'Camera', slug: 'camera', icon: 'photo_camera', sortOrder: 4 }
  });
  const watchDevType = await prisma.deviceType.create({
    data: { id: 'd0000000-0000-0000-0000-000000000005', name: 'Watch', slug: 'watch', icon: 'watch', sortOrder: 5 }
  });
  const consoleDevType = await prisma.deviceType.create({
    data: { id: 'd0000000-0000-0000-0000-000000000006', name: 'Gaming Console', slug: 'gaming-console', icon: 'sports_esports', sortOrder: 6 }
  });
  const airpodsDevType = await prisma.deviceType.create({
    data: { id: 'd0000000-0000-0000-0000-000000000007', name: 'AirPods', slug: 'airpods', icon: 'headphones', sortOrder: 7 }
  });
  const cardDevType = await prisma.deviceType.create({
    data: { id: 'd0000000-0000-0000-0000-000000000008', name: 'Card', slug: 'card', icon: 'credit_card', sortOrder: 8 }
  });
  const droneDevType = await prisma.deviceType.create({
    data: { id: 'd0000000-0000-0000-0000-000000000009', name: 'Drone', slug: 'drone', icon: 'flight', sortOrder: 9 }
  });

  console.log('Seeding Materials and Finishes...');
  const mat3M = await prisma.material.create({ data: { name: 'Standard 3M', slug: 'standard-3m', description: 'High durability imported 3M vinyl', priceOffset: 0.0, sortOrder: 1 } });
  const matCarbon = await prisma.material.create({ data: { name: 'Carbon Fiber', slug: 'carbon-fiber', description: 'Textured carbon weave finish', priceOffset: 100.0, sortOrder: 2 } });
  const matLeather = await prisma.material.create({ data: { name: 'Leather', slug: 'leather', description: 'Rich tactile leather pattern', priceOffset: 150.0, sortOrder: 3 } });
  const matTrans = await prisma.material.create({ data: { name: 'Transparent', slug: 'transparent', description: 'Ultra clear protective layer', priceOffset: 50.0, sortOrder: 4 } });
  const matWood = await prisma.material.create({ data: { name: 'Wood', slug: 'wood', description: 'Natural wood grain texture', priceOffset: 120.0, sortOrder: 5 } });
  const matMatteVin = await prisma.material.create({ data: { name: 'Matte Vinyl', slug: 'matte-vinyl', description: 'Clean smooth matte vinyl', priceOffset: 30.0, sortOrder: 6 } });

  const finMatte = await prisma.finish.create({ data: { name: 'Matte', slug: 'matte', priceOffset: 0.0, sortOrder: 1 } });
  const finGloss = await prisma.finish.create({ data: { name: 'Gloss', slug: 'gloss', priceOffset: 20.0, sortOrder: 2 } });
  const finSatin = await prisma.finish.create({ data: { name: 'Satin', slug: 'satin', priceOffset: 30.0, sortOrder: 3 } });
  const finUltraMatte = await prisma.finish.create({ data: { name: 'Ultra Matte', slug: 'ultra-matte', priceOffset: 40.0, sortOrder: 4 } });

  // Material-Finish allowed mappings
  await prisma.materialFinish.createMany({
    data: [
      { materialId: mat3M.id, finishId: finMatte.id },
      { materialId: mat3M.id, finishId: finGloss.id },
      { materialId: mat3M.id, finishId: finSatin.id },
      { materialId: matCarbon.id, finishId: finMatte.id },
      { materialId: matCarbon.id, finishId: finGloss.id },
      // Leather only supports Matte
      { materialId: matLeather.id, finishId: finMatte.id },
      { materialId: matTrans.id, finishId: finGloss.id },
      { materialId: matWood.id, finishId: finMatte.id },
      { materialId: matMatteVin.id, finishId: finMatte.id },
      { materialId: matMatteVin.id, finishId: finUltraMatte.id }
    ]
  });

  console.log('Seeding Brands, Series, and Models by DeviceType...');
  // Mobile Brands
  const apple = await prisma.brand.create({ data: { name: 'Apple', slug: 'apple', deviceTypeId: mobileDevType.id } });
  const samsung = await prisma.brand.create({ data: { name: 'Samsung', slug: 'samsung', deviceTypeId: mobileDevType.id } });
  const google = await prisma.brand.create({ data: { name: 'Google', slug: 'google', deviceTypeId: mobileDevType.id } });
  const oneplus = await prisma.brand.create({ data: { name: 'OnePlus', slug: 'oneplus', deviceTypeId: mobileDevType.id } });
  const nothing = await prisma.brand.create({ data: { name: 'Nothing', slug: 'nothing', deviceTypeId: mobileDevType.id } });

  // Camera Brands
  const canon = await prisma.brand.create({ data: { name: 'Canon', slug: 'canon', deviceTypeId: cameraDevType.id } });
  const sonyCam = await prisma.brand.create({ data: { name: 'Sony', slug: 'sony-camera', deviceTypeId: cameraDevType.id } });

  // Laptop Brands
  const appleLaptop = await prisma.brand.create({ data: { name: 'Apple MacBook', slug: 'apple-macbook', deviceTypeId: laptopDevType.id } });
  const dell = await prisma.brand.create({ data: { name: 'Dell', slug: 'dell', deviceTypeId: laptopDevType.id } });

  // Series
  const ip16Series = await prisma.series.create({ data: { name: 'iPhone 16 Series', brandId: apple.id } });
  const ip15Series = await prisma.series.create({ data: { name: 'iPhone 15 Series', brandId: apple.id } });
  const ip14Series = await prisma.series.create({ data: { name: 'iPhone 14 Series', brandId: apple.id } });
  const s24Series = await prisma.series.create({ data: { name: 'Galaxy S Series', brandId: samsung.id } });
  const px8Series = await prisma.series.create({ data: { name: 'Pixel 8 Series', brandId: google.id } });
  const canonEOS = await prisma.series.create({ data: { name: 'EOS Series', brandId: canon.id } });
  const sonyAlpha = await prisma.series.create({ data: { name: 'Alpha Series', brandId: sonyCam.id } });

  // Models (some with seriesId, some without series)
  const models = [
    { name: 'iPhone 16 Pro Max', brandId: apple.id, seriesId: ip16Series.id },
    { name: 'iPhone 16 Pro', brandId: apple.id, seriesId: ip16Series.id },
    { name: 'iPhone 15 Pro Max', brandId: apple.id, seriesId: ip15Series.id },
    { name: 'iPhone 15 Pro', brandId: apple.id, seriesId: ip15Series.id },
    { name: 'iPhone 15 Plus', brandId: apple.id, seriesId: ip15Series.id },
    { name: 'iPhone 15', brandId: apple.id, seriesId: ip15Series.id },
    { name: 'iPhone 14 Pro Max', brandId: apple.id, seriesId: ip14Series.id },
    { name: 'Samsung Galaxy S24 Ultra', brandId: samsung.id, seriesId: s24Series.id },
    { name: 'Samsung Galaxy S24+', brandId: samsung.id, seriesId: s24Series.id },
    { name: 'Samsung Galaxy S24', brandId: samsung.id, seriesId: s24Series.id },
    { name: 'Google Pixel 8 Pro', brandId: google.id, seriesId: px8Series.id },
    { name: 'Google Pixel 8', brandId: google.id, seriesId: px8Series.id },
    { name: 'OnePlus 12', brandId: oneplus.id }, // No series!
    { name: 'Nothing Phone 2', brandId: nothing.id }, // No series!
    // Camera models
    { name: 'Canon EOS R5', brandId: canon.id, seriesId: canonEOS.id },
    { name: 'Canon EOS R6 Mark II', brandId: canon.id, seriesId: canonEOS.id },
    { name: 'Sony Alpha A7 IV', brandId: sonyCam.id, seriesId: sonyAlpha.id },
    // Laptop models
    { name: 'MacBook Pro 16" (M3)', brandId: appleLaptop.id }, // No series!
    { name: 'MacBook Air 15" (M2)', brandId: appleLaptop.id }, // No series!
    { name: 'Dell XPS 15', brandId: dell.id } // No series!
  ];

  const seededModels = {};
  for (const m of models) {
    const created = await prisma.model.create({ data: m });
    seededModels[m.name] = created;
  }

  // Connect Products to compatible Models
  const productMappings = {
    1: ["iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 16 Pro", "iPhone 15 Plus", "iPhone 15", "iPhone 14 Pro Max"],
    2: ["Samsung Galaxy S24 Ultra", "Samsung Galaxy S24", "Samsung Galaxy S23 Ultra"],
    3: ["Google Pixel 8 Pro", "Google Pixel 8", "Google Pixel 7 Pro"],
    4: ["iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 16 Pro", "iPhone 16 Pro Max"],
    5: ["iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 16 Pro"],
    6: ["iPhone 15 Pro Max", "iPhone 15 Pro"],
    7: ["Samsung Galaxy S24 Ultra", "Samsung Galaxy S23 Ultra"],
    8: ["Google Pixel 8 Pro", "Google Pixel 7 Pro"],
    9: ["OnePlus 12", "OnePlus 11"],
    10: ["iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 16 Pro"],
    11: ["Google Pixel 8 Pro", "Google Pixel 8"],
    12: ["iPhone 16 Pro", "iPhone 16 Pro Max", "iPhone 15 Pro", "iPhone 15 Pro Max"]
  };

  for (const [prodIdStr, modelNames] of Object.entries(productMappings)) {
    const prodId = parseInt(prodIdStr);
    const productUuid = `10000000-0000-0000-0000-${String(prodId).padStart(12, '0')}`;
    const connectIds = modelNames
      .map(name => seededModels[name]?.id)
      .filter(Boolean)
      .map(id => ({ id }));
      
    await prisma.product.update({
      where: { id: productUuid },
      data: {
        models: {
          connect: connectIds
        }
      }
    });
  }

  console.log('Connecting Products to Collections...');
  const productCollections = {
    1: 'c0000000-0000-0000-0000-000000000006',
    2: 'c0000000-0000-0000-0000-000000000003',
    3: 'c0000000-0000-0000-0000-000000000004',
    4: 'c0000000-0000-0000-0000-000000000006',
    5: 'c0000000-0000-0000-0000-000000000004',
    6: 'c0000000-0000-0000-0000-000000000004',
    7: 'c0000000-0000-0000-0000-000000000003',
    8: 'c0000000-0000-0000-0000-000000000006',
    9: 'c0000000-0000-0000-0000-000000000004',
    10: 'c0000000-0000-0000-0000-000000000005',
    11: 'c0000000-0000-0000-0000-000000000004',
    12: 'c0000000-0000-0000-0000-000000000006',
  };

  for (const [prodIdStr, colId] of Object.entries(productCollections)) {
    const prodId = parseInt(prodIdStr);
    const productUuid = `10000000-0000-0000-0000-${String(prodId).padStart(12, '0')}`;
    await prisma.product.update({
      where: { id: productUuid },
      data: {
        collections: {
          connect: { id: colId }
        }
      }
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
