export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  plan: "free" | "pro" | "agency";
  clerkId?: string;
  videosUsedThisMonth?: number;
  videosLimit?: number;
  createdAt: string;
}

export interface Channel {
  id: string;
  userId: string;
  workspaceId?: string;
  youtubeChannelId?: string;
  channelName: string;
  channelHandle?: string;
  thumbnailUrl?: string;
  sourceId?: string;
  authStatus: string;
  videosUploaded: number;
  uploadsToday: number;
  quotaUsed: number;
  isActive: boolean;
  createdAt: string;
  workspaceName?: string;
  workspaceEmail?: string;
  gcpCredentialName?: string;
  gcpCredentialId?: string;
}

export interface VideoQueueItem {
  id: string;
  userId: string;
  sourceId?: string;
  targetChannelId?: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  title?: string;
  description?: string;
  tags?: string[];
  thumbnailUrl?: string;
  category?: string;
  visibility?: string;
  priority?: string;
  scheduledAt?: string;
  status: string;
  progress?: number;
  youtubeVideoId?: string;
  errorMessage?: string;
  srcViews?: number;
  srcLikes?: number;
  ytViews?: number;
  ytLikes?: number;
  createdAt: string;
}

export interface Source {
  id: string;
  userId: string;
  platform: string;
  accountHandle?: string;
  accountUrl?: string;
  linkedChannelId?: string;
  proxyId?: string;
  fetchFrequencyHours?: number;
  lastSyncedAt?: string;
  status: string;
}

export interface Workspace {
  id: string;
  userId: string;
  name?: string;
  email: string;
  gcpProjectId?: string;
  gcpEmail?: string;
  oauthFilePath?: string;
  youtubeOAuthTokenId?: string;
  channelCount?: number;
  authStatus: string;
  quotaUsedToday: number;
  isActive: boolean;
}

export interface Proxy {
  id: string;
  host: string;
  ipAddress: string;
  port: number;
  protocol: string;
  username?: string;
  password?: string;
  status: string;
  isAlive?: boolean;
  latencyMs?: number;
  speedMs?: number;
  successRate?: number;
  lastTestedAt?: string;
}

export interface Operation {
  id: string;
  userId: string;
  jobType: string;
  status: string;
  progress: number;
  relatedEntityType?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AnalyticsOverview {
  totalViews: number;
  subscribersGained: number;
  videosUploaded: number;
  uploadSuccessRate: number;
  failedUploads: number;
  totalChannels: number;
  queueCount: number;
}

export interface AnalyticsMetrics {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  subsGained: number;
  totalUploads: number;
  copyrightIssues: number;
  viewsChange: string;
  likesChange: string;
  viewsTrend: { date: string; views: number }[];
  trendingSources: { handle: string; platform: string; videos: number; ytViews: number }[];
  trendingVideos: { id: string; title: string; channel: string; ytViews: number; ytLikes: number; youtubeVideoId: string }[];
  subscriberGrowth: { channelName: string; subs: number }[];
  bestUploadTimes: { day: string; hour: number; avgViews: number }[];
  bestTime: string;
  totalUploadsAnalyzed: number;
}

export interface AnalyticsChannel {
  id: string;
  channelName: string;
  channelHandle?: string;
  sourceHandle: string;
  email: string;
  views: number;
  likes: number;
  comments: number;
  subs: number;
  uploads: number;
  copyrightIssues: number;
}

export interface AnalyticsVideo {
  id: string;
  title: string;
  thumbnailUrl?: string;
  createdAt: string;
  channelName: string;
  channelId: string;
  sourceHandle: string;
  srcViews: number;
  ytViews: number;
  ytLikes: number;
  ytComments: number;
  ytSubsGained: number;
  conversionRate: string;
  healthScore: number;
  copyrightStatus: string;
  youtubeVideoId?: string;
}

export interface AnalyticsSource {
  rank: number;
  handle: string;
  platform: string;
  videos: number;
  srcViews: number;
  ytViews: number;
  bestVideoTitle: string;
  bestVideoViews: number;
  bestVideoYoutubeId: string;
}

export interface AnalyticsHistoryItem {
  id: string;
  title: string;
  channelName: string;
  sourceHandle: string;
  sourcePlatform: string;
  ytViews: number;
  copyrightStatus: string;
  date: string;
  youtubeVideoId?: string;
}

export interface AnalyticsComment {
  id: string;
  channelId: string;
  videoId: string;
  youtubeCommentId: string;
  authorName: string;
  commentText: string;
  publishedAt: string;
  likeCount: number;
  isRead: boolean;
  replyText?: string;
  repliedAt?: string;
  videoTitle: string;
  videoYoutubeId: string;
  channelName: string;
}

export interface CopyrightSummary {
  clean: number;
  claimed: number;
  blocked: number;
  restricted: number;
}

export interface CopyrightItem {
  id: string;
  title: string;
  channelName: string;
  copyrightStatus: string;
  restrictionCountries: string;
  date: string;
  youtubeVideoId?: string;
}

export interface CopyrightData {
  summary: CopyrightSummary;
  items: CopyrightItem[];
}

export interface Schedule {
  id: string;
  userId: string;
  channelId?: string;
  cronExpression: string;
  timezone: string;
  maxVideosPerDay?: string;
  uploadTimes?: string;
  activeDays?: string;
  active: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  createdAt: string;
}

export interface TikTokVideo {
  id: string;
  title: string;
  author: string;
  authorUrl: string;
  duration: number;
  playUrl: string;
  coverUrl: string;
  likeCount: number;
  shareCount: number;
  commentCount: number;
  platform: string;
}

export interface Referral {
  id: string;
  userId: string;
  referredUserId?: string;
  code: string;
  status: string;
  reward: number;
  createdAt: string;
}
