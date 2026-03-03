import base64
import csv
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _write_text(path: Path, value: str) -> None:
    path.write_text(value, encoding="utf-8")


def _replace_assignment(content: str, variable: str, value_literal: str) -> str:
    pattern = rf"(?m)^({re.escape(variable)}\s*=\s*).*$"
    if not re.search(pattern, content):
        raise RuntimeError(f"Variable '{variable}' not found in config file")
    return re.sub(pattern, lambda match: f"{match.group(1)}{value_literal}", content)


def _json_list_literal(values: List[str]) -> str:
    return json.dumps(values, ensure_ascii=False)


def _count_rows(csv_path: Path) -> int:
    if not csv_path.exists():
        return 0
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        rows = list(reader)
    if not rows:
        return 0
    return max(len(rows) - 1, 0)


def _tail_new_rows(csv_path: Path, delta: int) -> List[Dict[str, str]]:
    if delta <= 0 or not csv_path.exists():
        return []
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        all_rows = list(reader)
    tail = all_rows[-delta:] if delta <= len(all_rows) else all_rows
    result: List[Dict[str, str]] = []
    for row in tail:
        result.append(
            {
                "jobId": row.get("Job ID", ""),
                "title": row.get("Title", ""),
                "company": row.get("Company", ""),
                "dateApplied": row.get("Date Applied", ""),
                "jobLink": row.get("Job Link", ""),
                "applicationLink": row.get("External Job link", ""),
            }
        )
    return result


def _safe_confirm(*args: Any, **kwargs: Any) -> str:
    buttons = kwargs.get("buttons")
    if isinstance(buttons, list) and buttons:
        if "Submit Application" in buttons:
            return "Submit Application"
        if "Look's good, Continue" in buttons:
            return "Look's good, Continue"
        return str(buttons[-1])
    return "OK"


def _patch_configs(repo_root: Path, payload: Dict[str, Any]) -> Tuple[Dict[Path, str], Path]:
    secrets_path = repo_root / "config" / "secrets.py"
    search_path = repo_root / "config" / "search.py"
    questions_path = repo_root / "config" / "questions.py"
    settings_path = repo_root / "config" / "settings.py"
    personals_path = repo_root / "config" / "personals.py"

    targets = [secrets_path, search_path, questions_path, settings_path, personals_path]
    originals = {path: _read_text(path) for path in targets}

    secrets_content = originals[secrets_path]
    secrets_content = _replace_assignment(secrets_content, "username", json.dumps(payload["username"]))
    secrets_content = _replace_assignment(secrets_content, "password", json.dumps(payload["password"]))
    _write_text(secrets_path, secrets_content)

    search_content = originals[search_path]
    search_content = _replace_assignment(
        search_content, "search_terms", _json_list_literal(payload["searchTerms"])
    )
    search_content = _replace_assignment(
        search_content, "search_location", json.dumps(payload["searchLocation"])
    )
    search_content = _replace_assignment(
        search_content, "switch_number", str(int(payload["maxApplications"]))
    )
    search_content = _replace_assignment(search_content, "pause_after_filters", "False")
    _write_text(search_path, search_content)

    questions_content = originals[questions_path]
    questions_content = _replace_assignment(
        questions_content,
        "job_marketing_contact_consent",
        json.dumps(payload["marketingConsent"]),
    )
    questions_content = _replace_assignment(questions_content, "pause_before_submit", "False")
    questions_content = _replace_assignment(questions_content, "pause_at_failed_question", "False")
    _write_text(questions_path, questions_content)

    settings_content = originals[settings_path]
    settings_content = _replace_assignment(settings_content, "run_non_stop", "False")
    settings_content = _replace_assignment(
        settings_content,
        "run_in_background",
        "True" if bool(payload.get("runInBackground", False)) else "False",
    )
    settings_content = _replace_assignment(settings_content, "keep_screen_awake", "False")
    settings_content = _replace_assignment(settings_content, "disable_extensions", "True")
    settings_content = _replace_assignment(settings_content, "stealth_mode", "False")
    settings_content = _replace_assignment(settings_content, "safe_mode", "True")
    _write_text(settings_path, settings_content)

    city = payload.get("currentCity", "").strip()
    if not city:
      location = payload.get("searchLocation", "").strip()
      city = location.split(",")[0].strip() if location else ""
    personals_content = originals[personals_path]
    personals_content = _replace_assignment(personals_content, "current_city", json.dumps(city))
    _write_text(personals_path, personals_content)

    csv_path = repo_root / "all excels" / "all_applied_applications_history.csv"
    return originals, csv_path


def _restore_configs(originals: Dict[Path, str]) -> None:
    for path, content in originals.items():
        _write_text(path, content)


def _run_bot(repo_root: Path) -> None:
    os.chdir(repo_root)
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    import pyautogui  # type: ignore

    pyautogui.FAILSAFE = False
    pyautogui.alert = lambda *args, **kwargs: "OK"  # type: ignore
    pyautogui.confirm = _safe_confirm  # type: ignore

    import runAiBot  # type: ignore

    # Disable run-cycle waits in automated backend invocation.
    runAiBot.sleep = lambda *args, **kwargs: None  # type: ignore
    runAiBot.main()


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing payload argument"}))
        return 1

    try:
        payload_raw = base64.b64decode(sys.argv[1]).decode("utf-8")
        payload = json.loads(payload_raw)
    except Exception as exc:
        print(json.dumps({"success": False, "error": f"Invalid payload: {exc}"}))
        return 1

    repo_root = Path(payload.get("repoRoot", "")).resolve()
    if not repo_root.exists():
        print(json.dumps({"success": False, "error": f"Repo root not found: {repo_root}"}))
        return 1

    originals: Dict[Path, str] = {}
    csv_path = repo_root / "all excels" / "all_applied_applications_history.csv"
    before_count = 0
    try:
        originals, csv_path = _patch_configs(repo_root, payload)
        before_count = _count_rows(csv_path)
        _run_bot(repo_root)
        after_count = _count_rows(csv_path)
        delta = max(after_count - before_count, 0)
        new_rows = _tail_new_rows(csv_path, delta)
        print(json.dumps({"success": True, "appliedDelta": delta, "newApplications": new_rows}))
        return 0
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
        return 1
    finally:
        if originals:
            try:
                _restore_configs(originals)
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
