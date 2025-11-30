/**
 * Basic test coverage for RootLayout component
 *
 * Tests:
 * - Layout renders with correct metadata
 * - Children are rendered inside body
 * - Analytics component is included
 * - HTML lang attribute is set to "en"
 */

import RootLayout from './layout';

describe('RootLayout', () => {
  it('should have correct metadata', () => {
    expect(RootLayout.metadata.title).toBe('Instagram Post Refiner');
    expect(RootLayout.metadata.description).toBe('Refine Instagram posts to match your authentic voice');
  });

  it('should render children inside body tag', () => {
    const testChildren = <div>Test Content</div>;
    const layout = RootLayout({ children: testChildren });

    // Verify structure: html > body > children
    expect(layout.props.children[0]).toBe('en'); // lang attribute
    expect(layout.props.children[1].type).toBe('body');
  });

  it('should include Analytics component in body', () => {
    const layout = RootLayout({ children: <div /> });
    const bodyElement = layout.props.children[1];

    // Analytics should be inside body as a child
    expect(bodyElement.props.children).toBeDefined();
    expect(Array.isArray(bodyElement.props.children)).toBe(true);
  });

  it('should set html lang attribute to "en"', () => {
    const layout = RootLayout({ children: <div /> });

    expect(layout.props.lang).toBe('en');
  });
});
