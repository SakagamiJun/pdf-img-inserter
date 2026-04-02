use pdfium_render::prelude::PdfRect;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextPosition {
    pub left: f32,
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
    pub width: f32,
    pub height: f32,
    pub page: u16,
}

impl TextPosition {
    pub fn from_pdf_rect(rect: PdfRect, page: u16) -> Self {
        Self {
            left: rect.left().value,
            top: rect.top().value,
            right: rect.right().value,
            bottom: rect.bottom().value,
            width: rect.width().value,
            height: rect.height().value,
            page,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelativeRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Copy)]
pub struct PdfPlacementRect {
    pub left: f32,
    pub bottom: f32,
    pub width: f32,
    pub height: f32,
}

impl PdfPlacementRect {
    pub fn top(self) -> f32 {
        self.bottom + self.height
    }

    pub fn right(self) -> f32 {
        self.left + self.width
    }
}

/// PDF uses a bottom-left origin; Web uses a top-left origin.
#[derive(Debug, Clone, Copy)]
pub struct CoordTransform {
    pub page_width: f32,
    pub page_height: f32,
}

impl CoordTransform {
    pub fn new(page_width: f32, page_height: f32) -> Self {
        Self {
            page_width,
            page_height,
        }
    }

    pub fn pdf_top_to_web_top(&self, pdf_top: f32) -> f32 {
        self.page_height - pdf_top
    }

    /// Convert a text anchor plus top-left visual offsets into a PDF placement rect.
    pub fn image_rect_from_text_anchor(
        &self,
        anchor: &TextPosition,
        offset_x: f32,
        offset_y: f32,
        width: f32,
        height: f32,
    ) -> PdfPlacementRect {
        let left = anchor.left + offset_x;
        let bottom = anchor.top - offset_y - height;

        PdfPlacementRect {
            left,
            bottom,
            width,
            height,
        }
    }

    pub fn text_rect_to_relative(&self, position: &TextPosition) -> RelativeRect {
        RelativeRect {
            x: safe_ratio(position.left, self.page_width),
            y: safe_ratio(self.pdf_top_to_web_top(position.top), self.page_height),
            width: safe_ratio(position.width, self.page_width),
            height: safe_ratio(position.height, self.page_height),
        }
    }

    pub fn placement_rect_to_relative(&self, rect: PdfPlacementRect) -> RelativeRect {
        RelativeRect {
            x: safe_ratio(rect.left, self.page_width),
            y: safe_ratio(self.page_height - rect.top(), self.page_height),
            width: safe_ratio(rect.width, self.page_width),
            height: safe_ratio(rect.height, self.page_height),
        }
    }

    pub fn is_visible(&self, rect: PdfPlacementRect) -> bool {
        rect.right() > 0.0
            && rect.top() > 0.0
            && rect.left < self.page_width
            && rect.bottom < self.page_height
    }
}

fn safe_ratio(value: f32, total: f32) -> f32 {
    if total.abs() <= f32::EPSILON {
        0.0
    } else {
        (value / total).clamp(0.0, 1.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_between_pdf_and_web_spaces() {
        let transform = CoordTransform::new(600.0, 800.0);

        assert!((transform.pdf_top_to_web_top(800.0) - 0.0).abs() < 0.01);
        assert!((transform.pdf_top_to_web_top(400.0) - 400.0).abs() < 0.01);
    }

    #[test]
    fn keeps_positive_y_offset_as_visual_downward_motion() {
        let transform = CoordTransform::new(600.0, 800.0);
        let anchor = TextPosition {
            left: 120.0,
            top: 700.0,
            right: 180.0,
            bottom: 680.0,
            width: 60.0,
            height: 20.0,
            page: 0,
        };

        let placement = transform.image_rect_from_text_anchor(&anchor, 10.0, 15.0, 40.0, 30.0);

        assert!((placement.left - 130.0).abs() < 0.01);
        assert!((placement.bottom - 655.0).abs() < 0.01);
    }
}
