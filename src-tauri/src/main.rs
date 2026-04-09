// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Some(code) = pdf_img_inserter_lib::batch::maybe_run_batch_worker_from_env() {
        std::process::exit(code);
    }

    pdf_img_inserter_lib::run()
}
