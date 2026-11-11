function Svg({ children, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconBox(props) {
  return (
    <Svg {...props}>
      <path d="M21 8.2 12 3 3 8.2v7.6L12 21l9-5.2V8.2Z" />
      <path d="M3.4 8.4 12 13l8.6-4.6" />
      <path d="M12 21v-8" />
    </Svg>
  );
}

export function IconCart(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="20" r="1.2" />
      <circle cx="18.5" cy="20" r="1.2" />
      <path d="M2.5 3h2.2l2.3 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20 6.8H6" />
    </Svg>
  );
}

export function IconReceipt(props) {
  return (
    <Svg {...props}>
      <path d="M6 2.5h12v19l-3-1.8-3 1.8-3-1.8-3 1.8v-19Z" />
      <path d="M9 7.5h6M9 11.5h6M9 15.5h4" />
    </Svg>
  );
}

export function IconSearch(props) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </Svg>
  );
}

export function IconPlus(props) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconMinus(props) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconTrash(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 6h17M9 6V3.5h6V6M6 6l1 15h10l1-15" />
      <path d="M10 10.5v6M14 10.5v6" />
    </Svg>
  );
}

export function IconDownload(props) {
  return (
    <Svg {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </Svg>
  );
}

export function IconCheck(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </Svg>
  );
}

export function IconAlert(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5M12 16.2v.3" />
    </Svg>
  );
}

export function IconX(props) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconImage(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 5-5 4 4 2.5-2.5L20 18" />
    </Svg>
  );
}

export function IconBarcode(props) {
  return (
    <Svg {...props}>
      <path d="M4 5v14M7 5v14M10 5v9M13 5v14M16 5v9M19 5v14" />
    </Svg>
  );
}

export function IconTag(props) {
  return (
    <Svg {...props}>
      <path d="M20.5 13.3 12.7 21a2 2 0 0 1-2.8 0l-6.9-6.9a2 2 0 0 1-.6-1.5L2.7 4 10 3.3a2 2 0 0 1 1.5.6l8.9 8.9a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.8" cy="8.2" r="1.4" />
    </Svg>
  );
}

export function IconChevron(props) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function IconHistory(props) {
  return (
    <Svg {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function IconRefresh(props) {
  return (
    <Svg {...props}>
      <path d="M20 11a8 8 0 1 0-.8 4.5" />
      <path d="M20 4.5V11h-6.5" />
    </Svg>
  );
}

export function IconWallet(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h12.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2.5 2.5 0 0 1-2.5-2.5v-10Z" />
      <path d="M3.5 8.5h15" />
      <path d="M16 13.5h2" />
    </Svg>
  );
}

export function IconEdit(props) {
  return (
    <Svg {...props}>
      <path d="M4 20h4.2L19.4 8.8a2.1 2.1 0 0 0 0-3l-1.2-1.2a2.1 2.1 0 0 0-3 0L4 15.8V20Z" />
      <path d="M13.6 6.2 17.8 10.4" />
    </Svg>
  );
}

export function IconChart(props) {
  return (
    <Svg {...props}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <rect x="7.5" y="12" width="3" height="5" rx="1" />
      <rect x="12.5" y="8.5" width="3" height="8.5" rx="1" />
      <rect x="17.5" y="5.5" width="3" height="11.5" rx="1" />
    </Svg>
  );
}

export function IconStore(props) {
  return (
    <Svg {...props}>
      <path d="M4 9.5V20h16V9.5" />
      <path d="M3 9.5 5 4h14l2 5.5a3 3 0 0 1-5.5 1.5 3 3 0 0 1-5 0 3 3 0 0 1-5 0A3 3 0 0 1 3 9.5Z" />
      <path d="M9.5 20v-5h5v5" />
    </Svg>
  );
}
