import type { ReactNode } from "react";

const s = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    {children}
  </svg>
);

export const navIcons: Record<string, ReactNode> = {
  home: s(<path d="M3 11l9-7 9 7M5 10v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />),
  wrench: s(<path d="M14.7 6.3a4 4 0 01-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 015.4-5.4l-2.6 2.6-2-2 2.6-2.6z" strokeLinecap="round" strokeLinejoin="round" />),
  doc: s(<><path d="M6 2h8l4 4v16H6z" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2v4h4M9 13h6M9 17h6" strokeLinecap="round" strokeLinejoin="round" /></>),
  chat: s(<path d="M21 11.5a8 8 0 01-11.5 7.2L4 20l1.3-5A8 8 0 1121 11.5z" strokeLinecap="round" strokeLinejoin="round" />),
  inbox: s(<path d="M3 13h5l2 3h4l2-3h5M3 13l3-8h12l3 8v6H3z" strokeLinecap="round" strokeLinejoin="round" />),
  building: s(<path d="M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2" strokeLinecap="round" strokeLinejoin="round" />),
  users: s(<path d="M16 19v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 9a3 3 0 100-6 3 3 0 000 6zM22 19v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" strokeLinecap="round" strokeLinejoin="round" />),
  card: s(<><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" strokeLinecap="round" /><path d="M6 14.5h4" strokeLinecap="round" /></>),
  checklist: s(<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />),
  calendar: s(<><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" strokeLinecap="round" /></>),
  info: s(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" strokeLinecap="round" /></>),
  alert: s(<path d="M12 4l9 16H3l9-16zM12 10v4M12 17.5v.5" strokeLinecap="round" strokeLinejoin="round" />),
  notice: s(<><path d="M8 4h8a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z" strokeLinejoin="round" /><path d="M9 9h6M9 12.5h6" strokeLinecap="round" /></>),
};
