export type AgentStatus = "active" | "idle" | "thinking" | "executing" | "error" | "completed";

export type AgentId = "research" | "coding" | "browsing" | "automation" | "content";

export interface ActivityLog {
  id: string;
  timestamp: Date;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

export interface AgentMetrics {
  efficiency: number;       // 0-100
  tasksCompleted: number;
  tasksQueued: number;
  processingSpeed: number;  // actions/sec
  uptime: number;           // seconds
  lastUpdate: Date;
}

// Research Agent specific
export interface ResearchAgentData {
  sourcesScanned: number;
  documentsAnalyzed: number;
  confidenceScore: number;
  currentQuery: string;
  recentFindings: string[];
  keywords: string[];
  activeSources: string[];
}

// Coding Agent specific
export interface CodingAgentData {
  activeFile: string;
  language: string;
  framework: string;
  linesWritten: number;
  bugsFixed: number;
  buildStatus: "passing" | "failing" | "building" | "idle";
  recentCommits: string[];
  codeSnippet: string;
  deploymentPulse: boolean;
}

// Browsing Agent specific
export interface BrowsingAgentData {
  activeUrl: string;
  pageTitle: string;
  tabsOpen: number;
  pagesVisited: number;
  extractionStatus: "extracting" | "navigating" | "idle" | "analyzing";
  visitedUrls: { url: string; title: string; status: "done" | "active" | "queued" }[];
  dataExtracted: string;
}

// Automation Agent specific
export interface AutomationAgentData {
  activeWorkflows: number;
  triggersFired: number;
  successRate: number;
  connectedSystems: string[];
  activePipeline: string;
  taskChain: { name: string; status: "done" | "active" | "pending" | "error" }[];
  recentEvents: string[];
}

// Content Agent specific
export interface ContentAgentData {
  activeCampaign: string;
  draftsCreated: number;
  wordCount: number;
  tone: string;
  contentPipeline: { title: string; type: string; status: "draft" | "review" | "ready" | "published" }[];
  recentIdeas: string[];
  publishReadiness: number;
}

export interface Agent {
  id: AgentId;
  name: string;
  purpose: string;
  color: string;
  accentColor: string;
  glowColor: string;
  status: AgentStatus;
  currentTask: string;
  progress: number;
  metrics: AgentMetrics;
  activityLog: ActivityLog[];
  data: ResearchAgentData | CodingAgentData | BrowsingAgentData | AutomationAgentData | ContentAgentData;
}

export interface GlobalActivity {
  id: string;
  agentId: AgentId;
  agentName: string;
  message: string;
  timestamp: Date;
  type: "info" | "success" | "warning" | "error";
}

export interface SystemMetrics {
  totalTasksToday: number;
  cpuUsage: number;
  memoryUsage: number;
  avgResponseTime: number;
  productivityScore: number;
  activeWorkflows: number;
  dataThoughput: number;
  networkLatency: number;
}

export interface Alert {
  id: string;
  agentId: AgentId | "system";
  message: string;
  severity: "info" | "warning" | "critical" | "success";
  timestamp: Date;
  read: boolean;
}
