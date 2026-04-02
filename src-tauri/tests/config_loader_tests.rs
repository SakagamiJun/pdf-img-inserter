mod common;

use std::path::PathBuf;

use common::TempWorkspace;
use pdf_img_inserter_lib::config::{
    create_default_config, load_config, normalize_legacy_managed_paths, save_config, AppConfig,
    GlobalConfig, PathSerializationMode, TaskConfig,
};

fn sample_task(name: &str, image_path: PathBuf) -> TaskConfig {
    TaskConfig {
        name: name.to_string(),
        search_text: "签名".to_string(),
        image_path,
        base_offset_x: 12,
        base_offset_y: 18,
        random_offset_x: 4,
        random_offset_y: 6,
        target_height_points: 72.0,
        enabled: true,
    }
}

#[test]
fn portable_config_round_trip_restores_absolute_paths() {
    let workspace = TempWorkspace::new("portable-config");
    let config_dir = workspace.create_dir("portable");
    let input_dir = workspace.create_dir("portable/input_pdfs");
    let output_dir = workspace.create_dir("portable/output_pdfs");
    let image_path = workspace.write_png("portable/assets/stamp.png", 64, 32);
    let config_path = config_dir.join("config.toml");

    let config = AppConfig {
        global: GlobalConfig {
            input_folder: input_dir.clone(),
            output_folder: output_dir.clone(),
        },
        tasks: vec![sample_task("印章", image_path.clone())],
    };

    save_config(&config_path, &config, PathSerializationMode::Portable).unwrap();

    let raw = std::fs::read_to_string(&config_path).unwrap();
    assert!(raw.contains("inputFolder = \"input_pdfs\""));
    assert!(raw.contains("outputFolder = \"output_pdfs\""));
    assert!(raw.contains("imagePath = \"assets/stamp.png\""));
    assert!(!raw.contains(&workspace.path().display().to_string()));

    let loaded = load_config(&config_path).unwrap();
    assert_eq!(loaded.global.input_folder, input_dir);
    assert_eq!(loaded.global.output_folder, output_dir);
    assert_eq!(loaded.tasks[0].image_path, image_path);
}

#[test]
fn create_default_config_creates_directories_and_absolute_managed_paths() {
    let workspace = TempWorkspace::new("managed-config");
    let config_path = workspace.path().join("app/config/config.toml");
    let input_dir = workspace.path().join("Documents/PDFImgInserter/input");
    let output_dir = workspace.path().join("Documents/PDFImgInserter/exports");

    create_default_config(
        &config_path,
        &input_dir,
        &output_dir,
        PathSerializationMode::Absolute,
    )
    .unwrap();

    assert!(input_dir.is_dir());
    assert!(output_dir.is_dir());
    assert!(config_path.is_file());

    let raw = std::fs::read_to_string(&config_path).unwrap();
    assert!(raw.contains(&input_dir.display().to_string()));
    assert!(raw.contains(&output_dir.display().to_string()));

    let loaded = load_config(&config_path).unwrap();
    assert_eq!(loaded.global.input_folder, input_dir);
    assert_eq!(loaded.global.output_folder, output_dir);
}

#[test]
fn normalize_legacy_managed_paths_only_rewrites_old_default_directories() {
    let workspace = TempWorkspace::new("legacy-migration");
    let legacy_dir = workspace.create_dir("legacy");
    let legacy_config_path = legacy_dir.join("config.toml");
    let legacy_input = legacy_dir.join("input_pdfs");
    let legacy_output = legacy_dir.join("output_pdfs");
    let new_input = workspace.path().join("Documents/PDFImgInserter/input");
    let new_output = workspace.path().join("Documents/PDFImgInserter/exports");

    let mut default_cfg = AppConfig {
        global: GlobalConfig {
            input_folder: legacy_input.clone(),
            output_folder: legacy_output.clone(),
        },
        tasks: Vec::new(),
    };

    normalize_legacy_managed_paths(
        &mut default_cfg,
        &legacy_config_path,
        &new_input,
        &new_output,
    );

    assert_eq!(default_cfg.global.input_folder, new_input);
    assert_eq!(default_cfg.global.output_folder, new_output);

    let custom_input = workspace.create_dir("custom/input");
    let custom_output = workspace.path().join("custom/output");
    let mut custom_cfg = AppConfig {
        global: GlobalConfig {
            input_folder: custom_input.clone(),
            output_folder: custom_output.clone(),
        },
        tasks: Vec::new(),
    };

    normalize_legacy_managed_paths(
        &mut custom_cfg,
        &legacy_config_path,
        workspace.path().join("Documents/new-input").as_path(),
        workspace.path().join("Documents/new-output").as_path(),
    );

    assert_eq!(custom_cfg.global.input_folder, custom_input);
    assert_eq!(custom_cfg.global.output_folder, custom_output);
}
