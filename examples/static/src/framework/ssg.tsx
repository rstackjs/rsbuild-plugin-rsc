export interface Page {
  url: string;
  name: string;
}

export interface TocNode {
  title: string;
  level: number;
  children: TocNode[];
}

export interface PageProps {
  pages: Page[];
  currentPage: Page;
}
