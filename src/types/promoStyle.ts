/**
 * How a promo card looks, and the gradient every part of it is painted with.
 *
 * Its own module so the blank palettes can be typed without importing the
 * campaign types, which import a palette back — the two named each other, and
 * that was the cycle. Nothing here imports anything.
 */

export interface GradientStyle {
  type: 'solid' | 'linear' | 'radial';
  startColor: string;
  endColor: string;
  direction?: string;
  midpoint?: number;
}

/** The look of a whole promo card: its placement, its ground, its five fields. */
export interface PromoStyle {
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  background: GradientStyle;
  textColor: string;
  titleStyle: {
    background: GradientStyle;
    textColor: string;
    textAlign?: 'left' | 'center' | 'right';
  };
  subheadingStyle: {
    background: GradientStyle;
    textColor: string;
    textAlign?: 'left' | 'center' | 'right';
  };
  descriptionStyle: {
    background: GradientStyle;
    textColor: string;
    textAlign?: 'left' | 'center' | 'right';
  };
  dateStyle: {
    background: GradientStyle;
    textColor: string;
    textAlign?: 'left' | 'center' | 'right';
    fontSize?: number;
  };
  buttonStyle: {
    background: GradientStyle;
    textColor: string;
    textAlign?: 'left' | 'center' | 'right';
  };
}
