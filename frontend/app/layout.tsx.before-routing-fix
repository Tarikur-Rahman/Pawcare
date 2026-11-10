import type {Metadata} from 'next';
import './globals.css';

export const metadata:Metadata = {
  title: {
    default: 'PawCare | Care for Every Companion',
    template: '%s | PawCare',
  },
  description: 'PawCare brings pet care, adoption, lost-and-found support, and pet supplies together.',
};

// The root layout wraps every route; authentication belongs only in
// the owner, veterinary, and administrator route-group layouts.
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
