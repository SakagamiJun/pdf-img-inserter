use std::ffi::OsStr;
use std::io::{BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::{Deserialize, Serialize};

use crate::config::TaskConfig;
use crate::error::{AppError, Result};
use crate::image::ImageCache;
use crate::pdf::{create_pdfium_with_path, process_pdf_file};

const BATCH_WORKER_FLAG: &str = "--batch-worker";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchWorkerRequest {
    input_file: PathBuf,
    output_file: PathBuf,
    tasks: Vec<TaskConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BatchWorkerResponse {
    pub insertions: u32,
    pub message: String,
}

pub(crate) fn current_worker_count(total_files: usize) -> usize {
    let available = std::thread::available_parallelism()
        .map(std::num::NonZeroUsize::get)
        .unwrap_or(1);

    total_files.max(1).min(available)
}

pub fn maybe_run_batch_worker_from_env() -> Option<i32> {
    let mut args = std::env::args_os();
    let _ = args.next();

    match args.next() {
        Some(flag) if flag == OsStr::new(BATCH_WORKER_FLAG) => Some(match run_batch_worker() {
            Ok(()) => 0,
            Err(error) => {
                eprintln!("{error}");
                1
            }
        }),
        _ => None,
    }
}

pub(crate) fn run_worker_process(
    executable_path: &Path,
    input_file: &Path,
    output_file: &Path,
    tasks: &[TaskConfig],
    pdfium_resource_dir: Option<&Path>,
) -> Result<BatchWorkerResponse> {
    let request = BatchWorkerRequest {
        input_file: input_file.to_path_buf(),
        output_file: output_file.to_path_buf(),
        tasks: tasks.to_vec(),
    };

    let mut command = Command::new(executable_path);
    command
        .arg(BATCH_WORKER_FLAG)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(resource_dir) = pdfium_resource_dir {
        command.env("PDFIUM_DYNAMIC_LIB_PATH", resource_dir);
    }

    let mut child = command.spawn().map_err(|error| {
        AppError::Config(format!(
            "启动批处理子进程失败 ({}): {error}",
            executable_path.display()
        ))
    })?;

    {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| AppError::Config("批处理子进程 stdin 不可用，无法发送任务".into()))?;
        serde_json::to_writer(&mut stdin, &request)
            .map_err(|error| AppError::Config(format!("写入批处理子进程请求失败: {error}")))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| AppError::Config(format!("等待批处理子进程结束失败: {error}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("子进程退出码: {:?}", output.status.code())
        };

        return Err(AppError::Config(format!("批处理子进程执行失败: {detail}")));
    }

    serde_json::from_slice(&output.stdout).map_err(|error| {
        AppError::Config(format!(
            "解析批处理子进程结果失败: {error}; 输出: {}",
            String::from_utf8_lossy(&output.stdout).trim()
        ))
    })
}

fn run_batch_worker() -> Result<()> {
    let request: BatchWorkerRequest = serde_json::from_reader(BufReader::new(std::io::stdin()))
        .map_err(|error| AppError::Config(format!("解析批处理子进程请求失败: {error}")))?;

    if !request.input_file.exists() || !request.input_file.is_file() {
        return Err(AppError::InvalidPath(format!(
            "输入 PDF 不存在或不是文件: {}",
            request.input_file.display()
        )));
    }

    if let Some(parent) = request.output_file.parent() {
        std::fs::create_dir_all(parent).map_err(AppError::from)?;
    }

    crate::ensure_distinct_output(&request.input_file, &request.output_file)?;

    for task in &request.tasks {
        crate::validate_runtime_task_fields(task)?;
        if !task.image_path.exists() || !task.image_path.is_file() {
            return Err(AppError::InvalidPath(format!(
                "任务图片不存在或不是文件 ({}): {}",
                task.name,
                task.image_path.display()
            )));
        }
    }

    let (pdfium, _) = create_pdfium_with_path(None)?;
    let result = process_pdf_file(
        &pdfium,
        &request.input_file,
        &request.output_file,
        &request.tasks,
        &ImageCache::default(),
    )?;

    let response = BatchWorkerResponse {
        insertions: result.insertions,
        message: result.message,
    };

    let mut stdout = BufWriter::new(std::io::stdout().lock());
    serde_json::to_writer(&mut stdout, &response)
        .map_err(|error| AppError::Config(format!("写入批处理子进程结果失败: {error}")))?;
    stdout.flush().map_err(AppError::from)
}

#[cfg(test)]
mod tests {
    use super::current_worker_count;

    #[test]
    fn current_worker_count_is_bounded_by_total_files() {
        assert_eq!(current_worker_count(1), 1);
        assert_eq!(current_worker_count(3), current_worker_count(3).min(3));
    }
}
