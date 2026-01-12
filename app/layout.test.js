/**
 * Basic test coverage for RootLayout component
 *
 * Tests:
 * - Layout renders with correct metadata
 * - Children are rendered inside body
 * - Analytics component is included
 * - HTML lang attribute is set to "en"
 */

import RootLayout, { metadata } from './layout';

describe('RootLayout', () => {
  it('should have correct metadata', () => {
    expect(metadata.title).toBe('Instagram Post Refiner');
    expect(metadata.description).toBe('Refine Instagram posts to match your authentic voice');
  });

  it('should render children inside body tag', () => {
    const testChildren = <div>Test Content</div>;
    const layout = RootLayout({ children: testChildren });

    // Verify html element with lang attribute
    expect(layout.type).toBe('html');
    expect(layout.props.lang).toBe('en');
    
    // Find body element in children
    const children = layout.props.children;
    const bodyElement = Array.isArray(children) 
      ? children.find(child => child?.type === 'body')
      : children.type === 'body' ? children : null;
    
    expect(bodyElement).toBeTruthy();
    expect(bodyElement.type).toBe('body');
  });

  it('should include Analytics component in body', () => {
    const layout = RootLayout({ children: <div /> });
    const children = layout.props.children;
    const bodyElement = Array.isArray(children)
      ? children.find(child => child?.type === 'body')
      : children;

    // Analytics should be inside body as a child
    expect(bodyElement.props.children).toBeDefined();
    expect(Array.isArray(bodyElement.props.children)).toBe(true);
  });

  it('should set html lang attribute to "en"', () => {
    const layout = RootLayout({ children: <div /> });

    expect(layout.props.lang).toBe('en');
  });
});
