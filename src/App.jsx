import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import { doc, initializeFirestore, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD-5zrSaRv2zzgiMx3Lhf7ywzAs0HS5bMw",
  authDomain: "gen-lang-client-0225718076.firebaseapp.com",
  projectId: "gen-lang-client-0225718076",
  storageBucket: "gen-lang-client-0225718076.firebasestorage.app",
  messagingSenderId: "810628243957",
  appId: "1:810628243957:web:bb67cebaeb572d3b3780bc"
};

const CLASSES = ["가람반", "나리반", "다솜반", "라온반", "마루반", "바름반", "사랑반"];
const ADMIN_PASSWORD = "0926";
const WRITE_TIMEOUT_MS = 8000;

const firebaseApp = initializeApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, { experimentalForceLongPolling: true, useFetchStreams: false });
const leagueDocRef = doc(db, "leagues", "grade4-basketball");

function buildInitialTeams() {
  return CLASSES.map((name) => ({ name, games: 0, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }));
}

function normalizeTeams(teams) {
  const byName = new Map((teams || []).map((team) => [team.name, team]));
  return CLASSES.map((name) => {
    const old = byName.get(name) || {};
    return {
      name,
      games: Number(old.games ?? 0),
      wins: Number(old.wins ?? old.matchWins ?? 0),
      draws: Number(old.draws ?? 0),
      losses: Number(old.losses ?? old.matchLosses ?? 0),
      pointsFor: Number(old.pointsFor ?? old.setWins ?? 0),
      pointsAgainst: Number(old.pointsAgainst ?? old.setLosses ?? 0),
    };
  });
}

function leaguePoints(team) { return team.wins * 3 + team.draws; }
function winRate(team) { return team.games ? team.wins / team.games : 0; }
function pointDiff(team) { return team.pointsFor - team.pointsAgainst; }

function sortTeams(teams) {
  return [...teams].sort((a, b) => {
    if (leaguePoints(b) !== leaguePoints(a)) return leaguePoints(b) - leaguePoints(a);
    const rateDiff = winRate(b) - winRate(a);
    if (rateDiff !== 0) return rateDiff;
    if (pointDiff(b) !== pointDiff(a)) return pointDiff(b) - pointDiff(a);
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.name.localeCompare(b.name, "ko");
  });
}

function firebaseErrorText(error) { return error ? `${error.code || "Firebase 오류"}: ${error.message || String(error)}` : ""; }

function withTimeout(promise, ms) {
  let timerId;
  const timer = new Promise((_, reject) => {
    timerId = window.setTimeout(() => reject(new Error("Firebase 저장 응답이 8초 안에 오지 않았습니다.")), ms);
  });
  return Promise.race([promise, timer]).finally(() => window.clearTimeout(timerId));
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const isAdmin = params.get("admin") === "1";

  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [teams, setTeams] = useState(buildInitialTeams());
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("Firebase 불러오는 중");
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const selectedBoth = teamA && teamB && teamA !== teamB;
  const scoresReady = scoreA !== "" && scoreB !== "" && Number(scoreA) >= 0 && Number(scoreB) >= 0;
  const aScore = Number(scoreA);
  const bScore = Number(scoreB);
  const resultText = scoresReady ? (aScore > bScore ? `${teamA} 승리` : aScore < bScore ? `${teamB} 승리` : "무승부") : "";
  const ranking = useMemo(() => sortTeams(teams), [teams]);
  const canEdit = isAdmin && adminUnlocked;
  const canSubmit = canEdit && selectedBoth && scoresReady && !saving;

  useEffect(() => {
    const unsubscribe = onSnapshot(leagueDocRef, (snapshot) => {
      setError("");
      if (snapshot.exists()) {
        const data = snapshot.data();
        setTeams(normalizeTeams(data.teams));
        setHistory(Array.isArray(data.history) ? data.history : []);
        setLastSaved(data.updatedAtText || "");
        setStatus(isAdmin ? "관리자 화면 · Firebase 연동 중" : "경기 결과 실시간 반영 중");
      } else {
        setTeams(buildInitialTeams());
        setHistory([]);
        setLastSaved("");
        setStatus(isAdmin ? "관리자 화면 · 첫 경기 입력 전" : "학생 화면 · 아직 경기 결과 없음");
      }
    }, (err) => {
      setStatus("Firebase 연결 실패");
      setError(firebaseErrorText(err));
    });
    return () => unsubscribe();
  }, [isAdmin]);

  function resetInput() { setScoreA(""); setScoreB(""); }

  async function saveLeague(nextTeams, nextHistory, successMessage) {
    setSaving(true);
    setError("");
    const nowText = new Date().toLocaleString("ko-KR");
    try {
      await withTimeout(setDoc(leagueDocRef, { teams: nextTeams, history: nextHistory, updatedAtText: nowText, updatedAt: serverTimestamp() }, { merge: false }), WRITE_TIMEOUT_MS);
      setStatus(successMessage);
      setLastSaved(nowText);
    } catch (err) {
      setStatus("Firebase 저장 실패");
      setError(firebaseErrorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitMatch() {
    if (!canSubmit) return;
    const nextTeams = teams.map((team) => {
      if (team.name === teamA) return { ...team, games: team.games + 1, wins: team.wins + (aScore > bScore ? 1 : 0), draws: team.draws + (aScore === bScore ? 1 : 0), losses: team.losses + (aScore < bScore ? 1 : 0), pointsFor: team.pointsFor + aScore, pointsAgainst: team.pointsAgainst + bScore };
      if (team.name === teamB) return { ...team, games: team.games + 1, wins: team.wins + (bScore > aScore ? 1 : 0), draws: team.draws + (aScore === bScore ? 1 : 0), losses: team.losses + (bScore < aScore ? 1 : 0), pointsFor: team.pointsFor + bScore, pointsAgainst: team.pointsAgainst + aScore };
      return team;
    });
    const nextHistory = [{ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, teamA, teamB, scoreA: aScore, scoreB: bScore, result: resultText, createdAt: new Date().toLocaleString("ko-KR") }, ...history];
    setTeams(nextTeams);
    setHistory(nextHistory);
    resetInput();
    await saveLeague(nextTeams, nextHistory, "클라우드 저장 완료 · 학생 화면에 반영됨");
  }

  async function resetAll() {
    if (!canEdit) return;
    if (!window.confirm("모든 경기 기록과 순위를 초기화할까요?")) return;
    const emptyTeams = buildInitialTeams();
    setTeamA(""); setTeamB(""); resetInput(); setTeams(emptyTeams); setHistory([]);
    await saveLeague(emptyTeams, [], "초기화 완료 · 학생 화면에 반영됨");
  }

  function unlockAdmin() { adminPassword === ADMIN_PASSWORD ? setAdminUnlocked(true) : alert("비밀번호가 틀렸습니다."); }
  const statusClass = status.includes("실패") ? "status error" : "status";

  return (
    <main className="page">
      <section className="app-shell">
        <header className="header">
          <div className="logo">🏀</div>
          <div>
            <h1>4학년 농구 리그전</h1>
            <p>{isAdmin ? "관리자 화면" : "실시간 순위표"}</p>
            <p className={statusClass}>{status}</p>
            {lastSaved && <p className="last-saved">마지막 저장: {lastSaved}</p>}
          </div>
        </header>

        {error && <section className="error-box"><strong>Firebase 오류</strong><p>{error}</p></section>}

        {isAdmin && !canEdit && (
          <section className="card">
            <h2>관리자 비밀번호</h2>
            <p className="password-guide">경기 결과 입력은 관리자만 할 수 있습니다.</p>
            <input className="password-input" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="비밀번호 입력" onKeyDown={(e) => { if (e.key === "Enter") unlockAdmin(); }} />
            <button className="submit-button" type="button" onClick={unlockAdmin}>관리자 입장</button>
          </section>
        )}

        {canEdit && (
          <section className="card">
            <div className="select-grid">
              <label><span>반 1</span><select value={teamA} onChange={(e) => { setTeamA(e.target.value); resetInput(); }}><option value="">선택</option>{CLASSES.map((name) => <option key={name} value={name} disabled={name === teamB}>{name}</option>)}</select></label>
              <label><span>반 2</span><select value={teamB} onChange={(e) => { setTeamB(e.target.value); resetInput(); }}><option value="">선택</option>{CLASSES.map((name) => <option key={name} value={name} disabled={name === teamA}>{name}</option>)}</select></label>
            </div>
            {selectedBoth ? (
              <div className="match-panel">
                <div className="score-box"><span>경기 스코어</span><strong>{teamA} {scoreA || 0} : {scoreB || 0} {teamB}</strong>{scoresReady && <em>{resultText}</em>}</div>
                <div className="score-input-grid">
                  <label><span>{teamA} 점수</span><input className="score-input" type="number" min="0" inputMode="numeric" value={scoreA} onChange={(e) => setScoreA(e.target.value)} /></label>
                  <label><span>{teamB} 점수</span><input className="score-input" type="number" min="0" inputMode="numeric" value={scoreB} onChange={(e) => setScoreB(e.target.value)} /></label>
                </div>
                <div className="draw-badge">{scoresReady && aScore === bScore ? "무승부로 입력됩니다" : "동점이면 자동으로 무승부 처리됩니다"}</div>
                <button className="submit-button" type="button" disabled={!canSubmit} onClick={submitMatch}>{saving ? "저장 중..." : "경기 결과 입력하기"}</button>
              </div>
            ) : <div className="empty-guide">상단에서 경기할 두 반을 선택하세요.</div>}
          </section>
        )}

        <section className="card">
          <div className="section-head"><h2>🏆 순위</h2>{canEdit && <button className="reset-button" type="button" onClick={resetAll}>초기화</button>}</div>
          <div className="podium">{ranking.slice(0, 3).map((team, index) => <div className={`podium-item top-${index + 1}`} key={team.name}><span>{index + 1}위</span><strong>{team.name}</strong><em>{leaguePoints(team)}점</em></div>)}</div>
          <div className="table-wrap"><table><thead><tr><th>순위</th><th>반</th><th>승점</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>득점</th></tr></thead><tbody>{ranking.map((team, index) => <tr key={team.name}><td className="rank">{index + 1}</td><td className="team-name">{team.name}</td><td className="set-diff">{leaguePoints(team)}</td><td>{team.wins}</td><td>{team.draws}</td><td>{team.losses}</td><td>{pointDiff(team)}</td><td>{team.pointsFor}</td></tr>)}</tbody></table></div>
          <p className="rule-note">정렬: 승점 → 승률 → 득실차 → 총득점 / 승점: 승 3점, 무 1점, 패 0점</p>
        </section>

        {history.length > 0 && <section className="card"><h2>{isAdmin ? "입력된 경기" : "최근 경기 결과"}</h2><div className="history-list">{history.slice(0, isAdmin ? history.length : 5).map((game) => <div className="history-card" key={game.id}><strong>{game.teamA} {game.scoreA} : {game.scoreB} {game.teamB}</strong><span>{game.result}</span><small>{game.createdAt}</small></div>)}</div></section>}
        {!isAdmin && <p className="viewer-note">학생용 화면입니다. 경기 결과 입력은 관리자만 가능합니다.</p>}
      </section>
    </main>
  );
}
