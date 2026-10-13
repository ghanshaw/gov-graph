// The Statistical Abstract of the United States, 2012: its 30 sections and their subsections as printed in the
// contents, with today's measures placed in them. The placements are a proposal for these mocks (Phase 4 of
// features/statistical-abstract gives every series its own). Dataset names from the local database, 2026-10-13.
export const SECTIONS = [
 {
  "n": 1,
  "title": "Population",
  "tables": "1–77",
  "subsections": [
   {
    "title": "Estimates and projections by age, sex, race, and Hispanic origin",
    "measures": []
   },
   {
    "title": "States, metropolitan areas, cities",
    "measures": []
   },
   {
    "title": "Mobility status",
    "measures": []
   },
   {
    "title": "Profiles of elderly, racial, and Hispanic-origin populations",
    "measures": []
   },
   {
    "title": "Native and foreign-born populations",
    "measures": []
   },
   {
    "title": "Immigration",
    "measures": []
   },
   {
    "title": "Ancestry, languages",
    "measures": []
   },
   {
    "title": "Marital status and households",
    "measures": []
   },
   {
    "title": "Religion",
    "measures": []
   }
  ]
 },
 {
  "n": 2,
  "title": "Births, Deaths, Marriages, and Divorces",
  "tables": "78–133",
  "subsections": [
   {
    "title": "Births",
    "measures": []
   },
   {
    "title": "Life expectancy",
    "measures": []
   },
   {
    "title": "Deaths",
    "measures": [
     {
      "key": "deaths",
      "label": "Deaths",
      "judgement": null,
      "datasets": [
       "COVID-19 Deaths",
       "Deaths from All Causes as a Share of Expected"
      ]
     }
    ]
   },
   {
    "title": "Marriages and divorces",
    "measures": []
   }
  ]
 },
 {
  "n": 3,
  "title": "Health and Nutrition",
  "tables": "134–218",
  "subsections": [
   {
    "title": "National Health Expenditure Accounts",
    "measures": []
   },
   {
    "title": "Medicare, Medicaid, and SCHIP",
    "measures": []
   },
   {
    "title": "Health insurance",
    "measures": []
   },
   {
    "title": "Employment",
    "measures": []
   },
   {
    "title": "Hospitals",
    "measures": []
   },
   {
    "title": "Health measures",
    "measures": []
   },
   {
    "title": "Food consumption, nutrition",
    "measures": []
   }
  ]
 },
 {
  "n": 4,
  "title": "Education",
  "tables": "219–305",
  "subsections": [
   {
    "title": "School enrollment",
    "measures": []
   },
   {
    "title": "Educational attainment",
    "measures": []
   },
   {
    "title": "Technology in schools",
    "measures": []
   },
   {
    "title": "Degrees conferred",
    "measures": []
   }
  ]
 },
 {
  "n": 5,
  "title": "Law Enforcement, Courts, and Prisons",
  "tables": "306–357",
  "subsections": [
   {
    "title": "Crime rates",
    "measures": []
   },
   {
    "title": "Crimes and arrests",
    "measures": []
   },
   {
    "title": "Courts",
    "measures": []
   },
   {
    "title": "Juveniles, child abuse",
    "measures": []
   },
   {
    "title": "Prisoners and inmates",
    "measures": []
   }
  ]
 },
 {
  "n": 6,
  "title": "Geography and Environment",
  "tables": "358–396",
  "subsections": [
   {
    "title": "Land and water",
    "measures": []
   },
   {
    "title": "Air quality",
    "measures": []
   },
   {
    "title": "Municipal hazardous waste",
    "measures": []
   },
   {
    "title": "Weather",
    "measures": []
   }
  ]
 },
 {
  "n": 7,
  "title": "Elections",
  "tables": "397–427",
  "subsections": [
   {
    "title": "Vote results",
    "measures": []
   },
   {
    "title": "Campaign finances",
    "measures": []
   }
  ]
 },
 {
  "n": 8,
  "title": "State and Local Government Finances and Employment",
  "tables": "428–468",
  "subsections": [
   {
    "title": "Governmental units",
    "measures": []
   },
   {
    "title": "Aid to state and local governments",
    "measures": []
   },
   {
    "title": "State and local governments",
    "measures": []
   },
   {
    "title": "State government finances",
    "measures": []
   },
   {
    "title": "Local government finances",
    "measures": []
   },
   {
    "title": "Employment and payroll",
    "measures": []
   }
  ]
 },
 {
  "n": 9,
  "title": "Federal Government Finances and Employment",
  "tables": "469–502",
  "subsections": [
   {
    "title": "Budget receipts, outlays, debt",
    "measures": [
     {
      "key": "federal-revenue",
      "label": "Federal revenue",
      "judgement": null,
      "datasets": [
       "Quarterly Federal Current Revenue (Annualized)",
       "Quarterly Federal Tax Revenue (Annualized)",
       "Quarterly Personal Taxes (Annualized)",
       "Quarterly Corporate Income Taxes (Annualized)",
       "Quarterly Excise Taxes (Annualized)",
       "Quarterly Taxes Paid from Abroad (Annualized)",
       "Quarterly Payroll Taxes (Annualized)",
       "Quarterly Federal Revenue (Annualized)",
       "Monthly Federal Revenue",
       "Monthly Individual Income Taxes",
       "Monthly Corporate Income Taxes",
       "Monthly Payroll Taxes (Social Security and Medicare)",
       "Monthly Unemployment Insurance Taxes",
       "Monthly Federal Employee Retirement Contributions",
       "Monthly Excise Taxes",
       "Monthly Estate and Gift Taxes",
       "Monthly Miscellaneous Revenue",
       "Monthly Federal Revenue Before Refunds",
       "Monthly Tax Refunds, All Federal Revenue",
       "Monthly Individual Income Taxes Before Refunds",
       "Monthly Individual Income Tax Refunds",
       "Monthly Corporate Income Taxes Before Refunds",
       "Monthly Corporate Income Tax Refunds",
       "Monthly Excise Taxes Before Refunds",
       "Monthly Excise Tax Refunds",
       "Monthly Estate and Gift Taxes Before Refunds",
       "Monthly Estate and Gift Tax Refunds",
       "Monthly Payroll Taxes Before Refunds",
       "Monthly Payroll Tax Refunds",
       "Daily Individual Tax Refunds (Since 2023)",
       "Daily Business Tax Refunds (Since 2023)",
       "Daily Individual Tax Refunds (2012–2023)",
       "Daily Business Tax Refunds (2012–2023)",
       "Taxes Withheld from Paychecks (Since 2023)",
       "Individual Taxes Paid Directly, Electronic",
       "Individual Taxes Paid Directly, Other Means",
       "Daily Corporate Income Taxes (Since 2023)",
       "Daily Excise Taxes (Since 2023)",
       "Daily Estate and Gift Taxes (Since 2023)",
       "Daily Estate, Gift and Other IRS Taxes (Since 2023)",
       "Daily Federal Unemployment Tax (Since 2023)",
       "Daily Railroad Retirement Taxes (Since 2023)",
       "Taxes Withheld from Paychecks (2005–2023)",
       "Daily Individual Taxes Paid Directly (2005–2023)",
       "Daily Corporate Income Taxes (2005–2023)",
       "Daily Excise Taxes (2005–2023)",
       "Daily Estate, Gift and Other IRS Taxes (2005–2023)",
       "Daily Federal Unemployment Tax (2005–2023)",
       "Daily Railroad Retirement Taxes (2005–2023)",
       "Yearly Federal Revenue",
       "Federal Revenue as a Share of GDP",
       "Yearly Individual Income Taxes",
       "Yearly Corporate Income Taxes",
       "Yearly Payroll Taxes",
       "Yearly Excise Taxes",
       "Yearly Other Federal Revenue",
       "Individual Income Taxes as a Share of All Revenue",
       "Corporate Income Taxes as a Share of All Revenue",
       "Payroll Taxes as a Share of All Revenue",
       "Excise Taxes as a Share of All Revenue",
       "Other Revenue as a Share of All Revenue",
       "Individual Income Taxes as a Share of GDP",
       "Corporate Income Taxes as a Share of GDP",
       "Payroll Taxes as a Share of GDP",
       "Excise Taxes as a Share of GDP",
       "Other Revenue as a Share of GDP",
       "Social Security Retirement Payroll Taxes",
       "Social Security Disability Payroll Taxes",
       "Medicare Payroll Taxes",
       "Yearly Unemployment Insurance Taxes",
       "Alcohol Taxes",
       "Tobacco Taxes",
       "Highway and Transit Taxes (Gas Tax)",
       "Airport and Airway Taxes",
       "Yearly Estate and Gift Taxes",
       "Federal Reserve Earnings Paid to the Treasury",
       "Yearly Tariff Revenue (USITC)",
       "Yearly Tariff Revenue (OMB)",
       "Quarterly Tariff Revenue (Annualized)",
       "Yearly Tariff Revenue (BEA)",
       "Monthly Tariff Revenue",
       "Monthly Tariff Revenue Before Refunds",
       "Monthly Tariff Refunds",
       "Daily Tariff Revenue (Since Nov 2025)",
       "Daily Tariff Revenue (2020–2025)",
       "Daily Tariff Revenue (2005–2020)"
      ]
     },
     {
      "key": "federal-spending",
      "label": "Federal spending",
      "judgement": null,
      "datasets": [
       "Quarterly Federal Spending (Annualized)",
       "Monthly Federal Spending",
       "Monthly Spending on National Defense",
       "Monthly Spending on International Affairs",
       "Monthly Spending on Science, Space and Technology",
       "Monthly Spending on Energy",
       "Monthly Spending on Natural Resources and Environment",
       "Monthly Spending on Agriculture",
       "Monthly Spending on Commerce and Housing Credit",
       "Monthly Spending on Transportation",
       "Monthly Spending on Community Development",
       "Monthly Spending on Education and Social Services",
       "Monthly Spending on Health, Excluding Medicare",
       "Monthly Spending on Medicare",
       "Monthly Spending on Income Security",
       "Monthly Spending on Social Security",
       "Monthly Spending on Veterans",
       "Monthly Spending on Justice",
       "Monthly Spending on General Government",
       "Monthly Net Interest on the National Debt",
       "Monthly Offsetting Receipts",
       "Yearly Federal Spending",
       "Federal Spending as a Share of GDP"
      ]
     },
     {
      "key": "federal-budget-balance",
      "label": "Federal budget balance",
      "judgement": null,
      "datasets": [
       "Quarterly Federal Budget Balance (Annualized)",
       "Monthly Federal Deficit",
       "Yearly Federal Budget Balance",
       "Federal Budget Balance as a Share of GDP"
      ]
     },
     {
      "key": "federal-debt",
      "label": "Federal debt",
      "judgement": null,
      "datasets": [
       "National Debt",
       "National Debt Held by the Public"
      ]
     }
    ]
   },
   {
    "title": "Income taxes",
    "measures": [
     {
      "key": "tax-rate",
      "label": "Tax rates",
      "judgement": null,
      "datasets": [
       "Average Federal Tax Rate of All Households",
       "Average Federal Tax Rate of the Lowest Quintile",
       "Average Federal Tax Rate of the Second Quintile",
       "Average Federal Tax Rate of the Middle Quintile",
       "Average Federal Tax Rate of the Fourth Quintile",
       "Average Federal Tax Rate of the Highest Quintile",
       "Average Federal Tax Rate of the 81st–90th Percentiles",
       "Average Federal Tax Rate of the 91st–95th Percentiles",
       "Average Federal Tax Rate of the 96th–99th Percentiles",
       "Average Federal Tax Rate of the Top 1 Percent",
       "Top Income Tax Rate",
       "Lowest Income Tax Rate"
      ]
     },
     {
      "key": "tax-share",
      "label": "Share of federal taxes paid",
      "judgement": null,
      "datasets": [
       "All Households’ Share of Federal Taxes",
       "Lowest Quintile’s Share of Federal Taxes",
       "Second Quintile’s Share of Federal Taxes",
       "Middle Quintile’s Share of Federal Taxes",
       "Fourth Quintile’s Share of Federal Taxes",
       "Highest Quintile’s Share of Federal Taxes",
       "81st–90th Percentiles’ Share of Federal Taxes",
       "91st–95th Percentiles’ Share of Federal Taxes",
       "96th–99th Percentiles’ Share of Federal Taxes",
       "Top 1 Percent’s Share of Federal Taxes"
      ]
     },
     {
      "key": "top-bracket-threshold",
      "label": "Where the top tax rate starts",
      "judgement": null,
      "datasets": [
       "Income Where the Top Tax Rate Starts"
      ]
     },
     {
      "key": "tax-credit-payments",
      "label": "Tax credit payments",
      "judgement": "Paid out through the Treasury; the Abstract has no table of them. Placed with income taxes because they are tax credits.",
      "datasets": [
       "Economic Impact Payments (Stimulus Checks)",
       "Advance Child Tax Credit Payments"
      ]
     }
    ]
   },
   {
    "title": "Federal employment and payroll",
    "measures": []
   }
  ]
 },
 {
  "n": 10,
  "title": "National Security and Veterans Affairs",
  "tables": "503–537",
  "subsections": [
   {
    "title": "National defense outlays, expenditures, personnel",
    "measures": []
   },
   {
    "title": "Military manpower",
    "measures": []
   },
   {
    "title": "Veterans",
    "measures": []
   },
   {
    "title": "Homeland security",
    "measures": []
   }
  ]
 },
 {
  "n": 11,
  "title": "Social Insurance and Human Services",
  "tables": "538–585",
  "subsections": [
   {
    "title": "Government transfer payments",
    "measures": []
   },
   {
    "title": "Social security",
    "measures": []
   },
   {
    "title": "Public aid, federal food programs",
    "measures": []
   },
   {
    "title": "Child care, child support",
    "measures": []
   }
  ]
 },
 {
  "n": 12,
  "title": "Labor Force, Employment, and Earnings",
  "tables": "586–666",
  "subsections": [
   {
    "title": "Labor force status",
    "measures": []
   },
   {
    "title": "Occupations",
    "measures": []
   },
   {
    "title": "Projections",
    "measures": []
   },
   {
    "title": "Unemployment",
    "measures": [
     {
      "key": "unemployment",
      "label": "Unemployment",
      "judgement": null,
      "datasets": [
       "Unemployment Rate",
       "Broad Unemployment Rate (U-6)",
       "Number of Unemployed People",
       "Unemployment Rate for White Workers",
       "Unemployment Rate for Black Workers",
       "Unemployment Rate for Asian Workers",
       "Unemployment Rate for Hispanic Workers",
       "Unemployment Rate for Men",
       "Unemployment Rate for Women",
       "Unemployment Rate for White Men",
       "Unemployment Rate for White Women",
       "Unemployment Rate for Black Men",
       "Unemployment Rate for Black Women",
       "Unemployment Rate for Hispanic Men",
       "Unemployment Rate for Hispanic Women",
       "Unemployment Rate for Workers Aged 16–19",
       "Unemployment Rate for Workers Aged 20–24",
       "Unemployment Rate for Workers Aged 25–34",
       "Unemployment Rate for Workers Aged 35–44",
       "Unemployment Rate for Workers Aged 45–54",
       "Unemployment Rate for Workers Aged 55 and Over",
       "Unemployment Rate for Men Aged 16–19",
       "Unemployment Rate for Women Aged 16–19",
       "Unemployment Rate for Men Aged 20–24",
       "Unemployment Rate for Women Aged 20–24",
       "Unemployment Rate for Men Aged 25–34",
       "Unemployment Rate for Women Aged 25–34",
       "Unemployment Rate for Men Aged 35–44",
       "Unemployment Rate for Women Aged 35–44",
       "Unemployment Rate for Men Aged 45–54",
       "Unemployment Rate for Women Aged 45–54",
       "Unemployment Rate for Men Aged 55 and Over",
       "Unemployment Rate for Women Aged 55 and Over",
       "Unemployment Rate for White Workers Aged 16–19",
       "Unemployment Rate for Black Workers Aged 16–19",
       "Unemployment Rate for Hispanic Workers Aged 16–19",
       "Unemployment Rate for White Men Aged 16–19",
       "Unemployment Rate for White Women Aged 16–19",
       "Unemployment Rate for Black Men Aged 16–19",
       "Unemployment Rate for Black Women Aged 16–19",
       "Unemployment Rate for Hispanic Men Aged 16–19",
       "Unemployment Rate for Hispanic Women Aged 16–19",
       "Unemployment Rate for Workers Without a High School Diploma",
       "Unemployment Rate for High School Graduates, No College",
       "Unemployment Rate for Workers with Some College",
       "Unemployment Rate for College Graduates",
       "Number of Unemployed White Workers",
       "Number of Unemployed Black Workers",
       "Number of Unemployed Asian Workers",
       "Number of Unemployed Hispanic Workers",
       "Number of Unemployed Men",
       "Number of Unemployed Women",
       "Number of Unemployed White Men",
       "Number of Unemployed White Women",
       "Number of Unemployed Black Men",
       "Number of Unemployed Black Women",
       "Number of Unemployed Hispanic Men",
       "Number of Unemployed Hispanic Women",
       "Number of Unemployed Workers Aged 16–19",
       "Number of Unemployed Workers Aged 20–24",
       "Number of Unemployed Workers Aged 25–34",
       "Number of Unemployed Workers Aged 35–44",
       "Number of Unemployed Workers Aged 45–54",
       "Number of Unemployed Workers Aged 55 and Over",
       "Number of Unemployed Men Aged 16–19",
       "Number of Unemployed Women Aged 16–19",
       "Number of Unemployed Men Aged 20–24",
       "Number of Unemployed Women Aged 20–24",
       "Number of Unemployed Men Aged 25–34",
       "Number of Unemployed Women Aged 25–34",
       "Number of Unemployed Men Aged 35–44",
       "Number of Unemployed Women Aged 35–44",
       "Number of Unemployed Men Aged 45–54",
       "Number of Unemployed Women Aged 45–54",
       "Number of Unemployed Men Aged 55 and Over",
       "Number of Unemployed Women Aged 55 and Over",
       "Number of Unemployed White Workers Aged 16–19",
       "Number of Unemployed Black Workers Aged 16–19",
       "Number of Unemployed Hispanic Workers Aged 16–19",
       "Number of Unemployed White Men Aged 16–19",
       "Number of Unemployed White Women Aged 16–19",
       "Number of Unemployed Black Men Aged 16–19",
       "Number of Unemployed Black Women Aged 16–19",
       "Number of Unemployed Hispanic Men Aged 16–19",
       "Number of Unemployed Hispanic Women Aged 16–19",
       "Number of Unemployed Workers Without a High School Diploma",
       "Number of Unemployed High School Graduates, No College",
       "Number of Unemployed Workers with Some College",
       "Number of Unemployed College Graduates"
      ]
     }
    ]
   },
   {
    "title": "Establishments",
    "measures": []
   },
   {
    "title": "Productivity",
    "measures": []
   },
   {
    "title": "Benefits",
    "measures": []
   },
   {
    "title": "Injuries",
    "measures": []
   },
   {
    "title": "Union membership",
    "measures": []
   }
  ]
 },
 {
  "n": 13,
  "title": "Income, Expenditures, Poverty, and Wealth",
  "tables": "667–723",
  "subsections": [
   {
    "title": "Gross domestic product",
    "measures": [
     {
      "key": "gdp",
      "label": "GDP",
      "judgement": null,
      "datasets": [
       "GDP (Annualized)",
       "GDP Adjusted for Inflation (Annualized)",
       "GDP Growth Rate (Adjusted for Inflation)"
      ]
     },
     {
      "key": "consumer-spending",
      "label": "Consumer spending",
      "judgement": null,
      "datasets": [
       "Consumer Spending (Annualized)",
       "Inflation-Adjusted Consumer Spending (Annualized)"
      ]
     }
    ]
   },
   {
    "title": "Personal income",
    "measures": []
   },
   {
    "title": "Consumer expenditures",
    "measures": []
   },
   {
    "title": "Money income",
    "measures": [
     {
      "key": "household-income",
      "label": "Household income",
      "judgement": null,
      "datasets": [
       "Median Household Income",
       "Median Household Income Adjusted for Inflation"
      ]
     }
    ]
   },
   {
    "title": "State income and poverty",
    "measures": []
   },
   {
    "title": "Poverty status",
    "measures": []
   },
   {
    "title": "Wealth",
    "measures": []
   }
  ]
 },
 {
  "n": 14,
  "title": "Prices",
  "tables": "724–743",
  "subsections": [
   {
    "title": "Consumer price index",
    "measures": [
     {
      "key": "consumer-prices",
      "label": "Consumer prices",
      "judgement": null,
      "datasets": [
       "Consumer Price Index (CPI)",
       "Core Consumer Price Index",
       "PCE Price Index",
       "Core PCE Price Index"
      ]
     }
    ]
   },
   {
    "title": "Cost of living index",
    "measures": []
   },
   {
    "title": "Producer price index",
    "measures": []
   }
  ]
 },
 {
  "n": 15,
  "title": "Business Enterprise",
  "tables": "744–798",
  "subsections": [
   {
    "title": "Sole proprietors, partnerships, corporations",
    "measures": []
   },
   {
    "title": "Establishments, employees, payroll",
    "measures": []
   },
   {
    "title": "Firms, births, deaths, expansions, and contractions",
    "measures": []
   },
   {
    "title": "Women- and minority-owned businesses",
    "measures": []
   },
   {
    "title": "Bankruptcy, patents",
    "measures": []
   },
   {
    "title": "Investment, capital expenditures",
    "measures": []
   },
   {
    "title": "Economic indicators",
    "measures": [
     {
      "key": "consumer-sentiment",
      "label": "Consumer sentiment",
      "judgement": "The University of Michigan’s index is in no table. Placed with the other economic indicators.",
      "datasets": [
       "Consumer Sentiment"
      ]
     }
    ]
   },
   {
    "title": "Corporate profits",
    "measures": []
   },
   {
    "title": "Multinationals",
    "measures": []
   }
  ]
 },
 {
  "n": 16,
  "title": "Science and Technology",
  "tables": "799–822",
  "subsections": [
   {
    "title": "R&D funds, outlays",
    "measures": []
   },
   {
    "title": "Science and engineering degrees",
    "measures": []
   },
   {
    "title": "Science and engineering employment",
    "measures": []
   },
   {
    "title": "Space program",
    "measures": []
   }
  ]
 },
 {
  "n": 17,
  "title": "Agriculture",
  "tables": "823–878",
  "subsections": [
   {
    "title": "Farms and farmland",
    "measures": []
   },
   {
    "title": "Farm balance sheet, income",
    "measures": []
   },
   {
    "title": "Agricultural exports and imports",
    "measures": []
   },
   {
    "title": "Crops, livestock",
    "measures": []
   }
  ]
 },
 {
  "n": 18,
  "title": "Forestry, Fishing, and Mining",
  "tables": "879–922",
  "subsections": [
   {
    "title": "Timber, lumber",
    "measures": []
   },
   {
    "title": "Fishery",
    "measures": []
   },
   {
    "title": "Petroleum, natural gas, coal",
    "measures": []
   }
  ]
 },
 {
  "n": 19,
  "title": "Energy and Utilities",
  "tables": "923–960",
  "subsections": [
   {
    "title": "Energy production, consumption",
    "measures": [
     {
      "key": "oil-demand",
      "label": "Oil demand",
      "judgement": null,
      "datasets": [
       "Oil Demand, All Products (4-Week Average)",
       "Diesel Demand (4-Week Average)",
       "Gasoline Demand (4-Week Average)",
       "Jet Fuel Demand (4-Week Average)",
       "Monthly Oil Demand, All Products",
       "Monthly Diesel Demand",
       "Monthly Gasoline Demand",
       "Monthly Jet Fuel Demand"
      ]
     }
    ]
   },
   {
    "title": "Expenditures",
    "measures": [
     {
      "key": "fuel-price",
      "label": "Fuel price at the pump",
      "judgement": null,
      "datasets": [
       "Regular Gas Price at the Pump",
       "Diesel Price at the Pump"
      ]
     }
    ]
   },
   {
    "title": "Crude oil",
    "measures": [
     {
      "key": "crude-oil-price",
      "label": "Crude oil price",
      "judgement": null,
      "datasets": [
       "U.S. Crude Oil Price (WTI)",
       "World Crude Oil Price (Brent)"
      ]
     }
    ]
   },
   {
    "title": "Nuclear",
    "measures": []
   },
   {
    "title": "Electric power",
    "measures": []
   },
   {
    "title": "Gas utilities",
    "measures": []
   }
  ]
 },
 {
  "n": 20,
  "title": "Construction and Housing",
  "tables": "961–1006",
  "subsections": [
   {
    "title": "Construction spending",
    "measures": []
   },
   {
    "title": "Home sales",
    "measures": [
     {
      "key": "home-prices",
      "label": "Home prices",
      "judgement": null,
      "datasets": [
       "Home Price Index",
       "Median Price of a New Home"
      ]
     },
     {
      "key": "home-affordability",
      "label": "Home affordability",
      "judgement": null,
      "datasets": [
       "Cost of Owning a Home as a Share of Income",
       "Home Affordability Index"
      ]
     }
    ]
   },
   {
    "title": "Homeownership",
    "measures": [
     {
      "key": "homeownership",
      "label": "Homeownership",
      "judgement": null,
      "datasets": [
       "Homeownership Rate"
      ]
     }
    ]
   },
   {
    "title": "Home remodeling",
    "measures": []
   }
  ]
 },
 {
  "n": 21,
  "title": "Manufactures",
  "tables": "1007–1041",
  "subsections": [
   {
    "title": "Manufacturing summary",
    "measures": []
   },
   {
    "title": "Hours and earnings of production workers",
    "measures": []
   },
   {
    "title": "Shipments, inventories, new orders, and finances",
    "measures": []
   },
   {
    "title": "Industry reports by subject and subsector",
    "measures": []
   }
  ]
 },
 {
  "n": 22,
  "title": "Wholesale and Retail Trade",
  "tables": "1042–1062",
  "subsections": [
   {
    "title": "Wholesale trade",
    "measures": []
   },
   {
    "title": "Retail trade",
    "measures": []
   }
  ]
 },
 {
  "n": 23,
  "title": "Transportation",
  "tables": "1063–1127",
  "subsections": [
   {
    "title": "Transportation system",
    "measures": []
   },
   {
    "title": "Air transportation",
    "measures": []
   },
   {
    "title": "Port traffic",
    "measures": []
   },
   {
    "title": "Motor vehicle registration",
    "measures": []
   },
   {
    "title": "Motor vehicle accidents",
    "measures": []
   },
   {
    "title": "Transit ridership, railroads",
    "measures": []
   }
  ]
 },
 {
  "n": 24,
  "title": "Information and Communications",
  "tables": "1128–1161",
  "subsections": [
   {
    "title": "Information industries",
    "measures": []
   },
   {
    "title": "Media usage",
    "measures": []
   },
   {
    "title": "Newspapers",
    "measures": []
   },
   {
    "title": "Books",
    "measures": []
   },
   {
    "title": "Recording media",
    "measures": []
   },
   {
    "title": "Telecommunications",
    "measures": []
   },
   {
    "title": "Internet access and use",
    "measures": []
   }
  ]
 },
 {
  "n": 25,
  "title": "Banking, Finance, and Insurance",
  "tables": "1162–1227",
  "subsections": [
   {
    "title": "Establishments, receipts",
    "measures": []
   },
   {
    "title": "Flow of funds, financial assets, and liabilities",
    "measures": []
   },
   {
    "title": "Financial institutions",
    "measures": []
   },
   {
    "title": "Payment instruments, credit and debit cards",
    "measures": []
   },
   {
    "title": "Consumer credit, mortgage debt",
    "measures": []
   },
   {
    "title": "Money stock, interest rates",
    "measures": [
     {
      "key": "interest-rate",
      "label": "Interest rates",
      "judgement": null,
      "datasets": [
       "Federal Funds Rate",
       "Lower End of the Fed’s Target Range",
       "Upper End of the Fed’s Target Range",
       "10-Year Treasury Yield",
       "2-Year Treasury Yield",
       "Prime Rate"
      ]
     },
     {
      "key": "mortgage-rate",
      "label": "Mortgage rate",
      "judgement": null,
      "datasets": [
       "30-Year Mortgage Rate"
      ]
     }
    ]
   },
   {
    "title": "Stocks and bonds, equity ownership, mutual funds",
    "measures": []
   },
   {
    "title": "Insurance",
    "measures": []
   }
  ]
 },
 {
  "n": 26,
  "title": "Arts, Recreation, and Travel",
  "tables": "1228–1271",
  "subsections": [
   {
    "title": "Employees, establishments, and payroll",
    "measures": []
   },
   {
    "title": "Performing arts",
    "measures": []
   },
   {
    "title": "Leisure activities",
    "measures": []
   },
   {
    "title": "Sports",
    "measures": []
   },
   {
    "title": "Parks and wildlife activities",
    "measures": []
   },
   {
    "title": "Travel",
    "measures": []
   }
  ]
 },
 {
  "n": 27,
  "title": "Accommodation, Food Services, and Other Services",
  "tables": "1272–1285",
  "subsections": [
   {
    "title": "Professional, scientific, and technical services",
    "measures": []
   },
   {
    "title": "Administrative and support and waste management",
    "measures": []
   }
  ]
 },
 {
  "n": 28,
  "title": "Foreign Commerce and Aid",
  "tables": "1286–1312",
  "subsections": [
   {
    "title": "International transactions",
    "measures": []
   },
   {
    "title": "Foreign investments",
    "measures": []
   },
   {
    "title": "Foreign grants and credits",
    "measures": []
   },
   {
    "title": "Exports and imports",
    "measures": [
     {
      "key": "exports",
      "label": "Exports",
      "judgement": null,
      "datasets": [
       "Quarterly Exports (Annualized)",
       "Quarterly Exports of Goods (Annualized)",
       "Quarterly Exports of Services (Annualized)",
       "Yearly Exports (BEA)",
       "Monthly Exports",
       "Monthly Exports of Goods",
       "Monthly Exports of Services",
       "Yearly Exports (Census)",
       "Yearly Exports of Goods",
       "Yearly Exports of Services"
      ]
     },
     {
      "key": "imports",
      "label": "Imports",
      "judgement": null,
      "datasets": [
       "Yearly Imports of Goods (USITC)",
       "Quarterly Imports (Annualized)",
       "Quarterly Imports of Goods (Annualized)",
       "Quarterly Imports of Services (Annualized)",
       "Yearly Imports (BEA)",
       "Monthly Imports",
       "Monthly Imports of Goods",
       "Monthly Imports of Services",
       "Yearly Imports (Census)",
       "Yearly Imports of Goods (Census)",
       "Yearly Imports of Services"
      ]
     },
     {
      "key": "trade-balance",
      "label": "Trade balance",
      "judgement": null,
      "datasets": [
       "Quarterly Trade Balance (Annualized)",
       "Yearly Trade Balance (BEA)",
       "Monthly Trade Balance",
       "Monthly Trade Balance in Goods",
       "Monthly Trade Balance in Services",
       "Yearly Trade Balance (Census)",
       "Yearly Trade Balance in Goods",
       "Yearly Trade Balance in Services"
      ]
     },
     {
      "key": "tariff-rate",
      "label": "Average tariff rate",
      "judgement": null,
      "datasets": [
       "Average Tariff Rate on All Imports",
       "Average Tariff Rate on Imports Subject to Tariffs"
      ]
     }
    ]
   }
  ]
 },
 {
  "n": 29,
  "title": "Puerto Rico and the Island Areas",
  "tables": "1313–1328",
  "subsections": []
 },
 {
  "n": 30,
  "title": "International Statistics",
  "tables": "1329–1406",
  "subsections": [
   {
    "title": "World maps",
    "measures": []
   },
   {
    "title": "World population, vital statistics",
    "measures": []
   },
   {
    "title": "Economic measures",
    "measures": []
   },
   {
    "title": "Labor force",
    "measures": []
   },
   {
    "title": "Agriculture",
    "measures": []
   },
   {
    "title": "Energy",
    "measures": []
   },
   {
    "title": "Finance",
    "measures": []
   }
  ]
 }
];

// What is on the timeline in the screenshot the user sent: Home affordability 2, Federal debt 1, Tax credit payments 2.
export const ON = { 'home-affordability': 2, 'federal-debt': 1, 'tax-credit-payments': 2 };
