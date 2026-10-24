const ALIASES: Readonly<Record<string, readonly string[]>> = {
  js: ['javascript'],
  javascript: ['javascript'],
  ecmascript: ['javascript'],
  ts: ['typescript'],
  typescript: ['typescript'],
  python: ['python'],
  py: ['python'],
  java: ['java'],
  'c++': ['cpp'],
  cpp: ['cpp'],
  'c plus plus': ['cpp'],
  'c#': ['csharp'],
  csharp: ['csharp'],
  'c sharp': ['csharp'],
  go: ['go'],
  golang: ['go'],
  ruby: ['ruby'],
  'ruby on rails': ['ruby'],
  sql: ['sql'],
  postgres: ['sql'],
  postgresql: ['sql'],
  psql: ['sql'],
  mysql: ['sql'],
  sqlite: ['sql'],
  mssql: ['sql'],
  mongodb: ['mongodb'],
  mongo: ['mongodb'],
  nosql: ['mongodb'],
  react: ['react'],
  reactjs: ['react'],
  'react.js': ['react'],
  nextjs: ['nextjs'],
  'next.js': ['nextjs'],
  node: ['node'],
  nodejs: ['node'],
  'node.js': ['node'],
  'node js': ['node'],
  express: ['express'],
  'express.js': ['express'],
  git: ['git'],
  github: ['git'],
  docker: ['docker'],
  kubernetes: ['kubernetes'],
  k8s: ['kubernetes'],
  aws: ['aws'],
  azure: ['azure'],
  gcp: ['gcp'],
  'google cloud': ['gcp'],
  ml: ['machine_learning'],
  'machine learning': ['machine_learning'],
  dsa: ['data_structures', 'algorithms'],
  'data structures': ['data_structures'],
  'data structures and algorithms': ['data_structures', 'algorithms'],
  algorithms: ['algorithms'],
  html: ['html'],
  css: ['css'],
  tailwind: ['css'],
  api: ['apis'],
  apis: ['apis'],
  rest: ['apis'],
  'rest api': ['apis'],
  'rest apis': ['apis'],
  'api testing': ['api_testing'],
  debugging: ['debugging'],
  communication: ['communication'],
  'problem solving': ['problem_solving'],
  playwright: ['playwright'],
  testing: ['testing'],
  postman: ['postman'],
  'ci/cd': ['ci_cd'],
  cicd: ['ci_cd'],
  jenkins: ['jenkins'],
  'github actions': ['github_actions'],
  'gh actions': ['github_actions'],
  websocket: ['websocket'],
  websockets: ['websocket'],
  'state management': ['state_management'],
  zustand: ['state_management'],
  redux: ['state_management'],
  'data visualization': ['data_visualization'],
  'data visualisation': ['data_visualization'],
  d3: ['data_visualization'],
  'd3.js': ['data_visualization'],
  recharts: ['data_visualization'],
  threejs: ['threejs'],
  'three.js': ['threejs'],
  'offline first': ['offline_first'],
  'offline-first': ['offline_first'],
  temporal: ['temporal'],
  opensearch: ['opensearch'],
  elasticsearch: ['opensearch'],
  'distributed systems': ['distributed_systems'],
  'llm serving': ['llm_serving'],
  'data modeling': ['data_modeling'],
  'data modelling': ['data_modeling'],
  'solution delivery': ['solution_delivery'],
  'enterprise integrations': ['enterprise_integrations'],
  fastapi: ['fastapi'],
  django: ['django'],
  flask: ['flask'],
  redis: ['redis'],
  graphql: ['graphql'],
  linux: ['linux'],
  'system design': ['system_design'],
};

const LABELS: Readonly<Record<string, string>> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  ruby: 'Ruby',
  sql: 'SQL',
  mongodb: 'MongoDB',
  react: 'React',
  nextjs: 'Next.js',
  node: 'Node.js',
  express: 'Express',
  git: 'Git',
  docker: 'Docker',
  kubernetes: 'Kubernetes',
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'GCP',
  machine_learning: 'Machine learning',
  data_structures: 'Data structures',
  algorithms: 'Algorithms',
  html: 'HTML',
  css: 'CSS',
  apis: 'APIs',
  api_testing: 'API testing',
  debugging: 'Debugging',
  communication: 'Communication',
  problem_solving: 'Problem solving',
  playwright: 'Playwright',
  testing: 'Testing',
  postman: 'Postman',
  ci_cd: 'CI/CD',
  jenkins: 'Jenkins',
  github_actions: 'GitHub Actions',
  websocket: 'WebSocket',
  state_management: 'State management',
  data_visualization: 'Data visualization',
  threejs: 'Three.js',
  offline_first: 'Offline-first',
  temporal: 'Temporal',
  opensearch: 'OpenSearch',
  distributed_systems: 'Distributed systems',
  llm_serving: 'LLM serving',
  data_modeling: 'Data modeling',
  solution_delivery: 'Solution delivery',
  enterprise_integrations: 'Enterprise integrations',
  fastapi: 'FastAPI',
  django: 'Django',
  flask: 'Flask',
  redis: 'Redis',
  graphql: 'GraphQL',
  linux: 'Linux',
  system_design: 'System design',
};

export const STACK_SIGNAL_SKILLS: Readonly<Record<string, readonly string[]>> = {
  typescript_javascript: ['typescript', 'javascript'],
  python: ['python'],
  java: ['java'],
  cpp: ['cpp'],
  csharp: ['csharp'],
  go: ['go'],
  sql: ['sql'],
  react: ['react'],
  node: ['node'],
  other: [],
};

export function normalizeSkillText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}+#./ -]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalizeSkill(value: string): readonly string[] {
  const normalized = normalizeSkillText(value);
  if (!normalized) return [];
  if (ALIASES[normalized]) return ALIASES[normalized];
  const token = normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return token ? [token] : [];
}

export function canonicalizeSkills(values: readonly string[]): string[] {
  const out = new Set<string>();
  for (const value of values) {
    for (const skill of canonicalizeSkill(value)) out.add(skill);
  }
  return [...out];
}

export function skillLabel(skill: string): string {
  return LABELS[skill] ?? skill.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function splitSkillText(value: string): string[] {
  return value
    .split(/[,;/\n]|\band\b/gi)
    .map((part) => part.trim())
    .filter(Boolean);
}
