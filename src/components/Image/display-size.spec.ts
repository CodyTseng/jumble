import { describe, expect, it } from 'vitest'
import {
  getImageMaxZoom,
  getLightboxImageSize,
  isSmallInlineImage,
  isSmallLightboxImage
} from './display-size'

describe('inline small images', () => {
  it('only enlarges images narrower than 480px with valid dimensions', () => {
    expect(isSmallInlineImage({ width: 220, height: 164 })).toBe(true)
    expect(isSmallInlineImage({ width: 480, height: 360 })).toBe(false)
    expect(isSmallInlineImage({ width: 2000, height: 1500 })).toBe(false)
    expect(isSmallInlineImage()).toBe(false)
    expect(isSmallInlineImage({ width: 0, height: 164 })).toBe(false)
    expect(isSmallInlineImage({ width: 220, height: Infinity })).toBe(false)
  })
})

describe('lightbox display size', () => {
  const pane = { width: 1408, height: 868 }

  it('only opts into custom display sizing when both axes are below the target', () => {
    expect(isSmallLightboxImage({ width: 220, height: 164 })).toBe(true)
    expect(isSmallLightboxImage({ width: 720, height: 100 })).toBe(false)
    expect(isSmallLightboxImage({ width: 100, height: 540 })).toBe(false)
    expect(isSmallLightboxImage({ width: 2000, height: 1000 })).toBe(false)
    expect(isSmallLightboxImage()).toBe(false)
  })

  it('fits a small landscape image inside the 720×540 target', () => {
    const size = getLightboxImageSize({ width: 220, height: 164 }, pane)
    expect(size.width).toBe(720)
    expect(size.height).toBeCloseTo(536.727)
  })

  it('caps a small portrait at the target height', () => {
    expect(getLightboxImageSize({ width: 100, height: 200 }, pane)).toEqual({
      width: 270,
      height: 540
    })
  })

  it('does not stretch extreme aspect ratios to meet both target dimensions', () => {
    expect(getLightboxImageSize({ width: 200, height: 20 }, pane)).toEqual({
      width: 720,
      height: 72
    })
    expect(getLightboxImageSize({ width: 20, height: 200 }, pane)).toEqual({
      width: 54,
      height: 540
    })
  })

  it('preserves natural dimensions once either target axis is filled', () => {
    for (const natural of [
      { width: 800, height: 600 },
      { width: 1000, height: 100 },
      { width: 100, height: 600 }
    ]) {
      expect(getLightboxImageSize(natural, pane)).toEqual(natural)
    }
  })

  it('scales large media down to the available pane, preserving aspect ratio', () => {
    expect(getLightboxImageSize({ width: 2000, height: 1000 }, pane)).toEqual({
      width: 1408,
      height: 704
    })
    const size = getLightboxImageSize({ width: 3024, height: 4032 }, pane)
    expect(size.width).toBe(651)
    expect(size.height).toBe(868)
  })

  it('clamps small images to narrow and short panes', () => {
    expect(
      getLightboxImageSize({ width: 220, height: 164 }, { width: 188, height: 400 }).width
    ).toBe(188)
    const size = getLightboxImageSize({ width: 220, height: 164 }, { width: 600, height: 300 })
    expect(size.height).toBe(300)
    expect(size.width / size.height).toBeCloseTo(220 / 164)
  })

  it('leaves invalid or not-yet-measured sizes alone', () => {
    const natural = { width: 220, height: 164 }
    expect(getLightboxImageSize(natural, { width: 0, height: 0 })).toEqual(natural)
    expect(getLightboxImageSize({ width: 0, height: 164 }, pane)).toEqual({ width: 0, height: 164 })
  })
})

describe('zoom uses natural resolution relative to displayed dimensions', () => {
  it('does not allow further pixel enlargement by default for upscaled images', () => {
    expect(getImageMaxZoom({ width: 220, height: 164 }, { width: 720, height: 536.727 })).toBe(1)
  })

  it('retains native resolution zoom for downscaled large images', () => {
    expect(getImageMaxZoom({ width: 2000, height: 1000 }, { width: 1000, height: 500 })).toBe(2)
    expect(getImageMaxZoom({ width: 2000, height: 1000 }, { width: 1000, height: 500 }, 2)).toBe(4)
  })
})
