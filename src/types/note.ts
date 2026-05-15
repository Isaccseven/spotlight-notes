export type Note = {
  id: string;
  text: string;
  createdAt: number;
  pinned: boolean;
  buffer?: boolean;
  tags?: string[];
};
