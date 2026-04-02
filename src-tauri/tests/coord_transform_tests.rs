use pdf_img_inserter_lib::coord::{CoordTransform, PdfPlacementRect, TextPosition};

#[test]
fn placement_rect_converts_to_web_relative_space() {
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
    let relative = transform.placement_rect_to_relative(placement);

    assert!((relative.x - 0.216_666_67).abs() < 0.0001);
    assert!((relative.y - 0.143_75).abs() < 0.0001);
    assert!((relative.width - 0.066_666_67).abs() < 0.0001);
    assert!((relative.height - 0.0375).abs() < 0.0001);
}

#[test]
fn visibility_rejects_fully_outside_rectangles() {
    let transform = CoordTransform::new(600.0, 800.0);

    assert!(transform.is_visible(PdfPlacementRect {
        left: 10.0,
        bottom: 10.0,
        width: 40.0,
        height: 20.0,
    }));
    assert!(!transform.is_visible(PdfPlacementRect {
        left: -120.0,
        bottom: 10.0,
        width: 40.0,
        height: 20.0,
    }));
    assert!(!transform.is_visible(PdfPlacementRect {
        left: 10.0,
        bottom: 820.0,
        width: 40.0,
        height: 20.0,
    }));
}
