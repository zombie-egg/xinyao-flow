export const customerStatusText: Record<string, string> = {
  POTENTIAL: "潜在客户",
  INITIAL_CONTACT: "初步接触",
  FOLLOWING: "持续跟进",
  WON: "成交客户",
  LOYAL: "忠诚客户",
};

export const businessLineText: Record<string, string> = {
  ENVIRONMENTAL_MONITORING: "环境检测",
  PUBLIC_HEALTH: "公共卫生",
  OCCUPATIONAL_HEALTH: "职业卫生",
};

export const customerNatures = [
  "普通客户",
  "VIP客户",
  "VVIP客户",
  "政府事业单位",
] as const;

export const monitoringTypes = [
  "年度检测",
  "验收检测",
  "ISO体系检测",
  "水质检测",
  "土壤检测/土调项目",
  "应急预案",
];
