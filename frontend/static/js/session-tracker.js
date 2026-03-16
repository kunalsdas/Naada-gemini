/**
 * SessionTracker — Wellness scores, mood journey, session reports, streaks, heatmap, courses, spotify, insights
 * Mixin for NaadaApp prototype.
 */

const SessionTracker = {
    _updateWellnessScore(score, indicators) {
        score = Math.max(0, Math.min(100, score));
        this._wellnessScores.push({ score, indicators, time: new Date() });
        if (this._initialWellnessScore === null) this._initialWellnessScore = score;
        this._currentWellnessScore = score;

        if (this.el.wellnessGauge) this.el.wellnessGauge.style.display = "flex";
        if (this.el.wellnessScoreNumber) this.el.wellnessScoreNumber.textContent = score;

        if (this.el.wellnessRingFill) {
            const circumference = 326.73;
            const offset = circumference - (score / 100) * circumference;
            this.el.wellnessRingFill.style.strokeDashoffset = offset;

            let color;
            if (score <= 30) color = "#10b981";
            else if (score <= 50) color = "#06b6d4";
            else if (score <= 70) color = "#f59e0b";
            else color = "#ef4444";
            this.el.wellnessRingFill.style.stroke = color;
            if (this.el.wellnessScoreNumber) this.el.wellnessScoreNumber.style.color = color;
        }

        if (this._initialWellnessScore !== null && this._wellnessScores.length > 1) {
            const improvement = this._initialWellnessScore - score;
            const pct = Math.round((improvement / Math.max(this._initialWellnessScore, 1)) * 100);
            if (improvement > 0 && this.el.wellnessImprovement) {
                this.el.wellnessImprovement.style.display = "flex";
                this.el.wellnessImprovementText.textContent = `${pct}% reduced`;
            }
        }
    },

    // --- Mood Journey Timeline ---

    _addMoodEntry(emotion, confidence, trigger) {
        this._moodJourney.push({
            emotion, confidence, trigger,
            color: (MOOD_COLORS[emotion] || ["#6b5ce7","#a78bfa"])[1],
            time: new Date(),
        });
        this._renderMoodJourney();
    },

    _renderMoodJourney() {
        if (!this.el.moodJourneyTimeline || !this.el.moodJourney) return;
        if (this._moodJourney.length === 0) {
            this.el.moodJourney.style.display = "none";
            return;
        }
        this.el.moodJourney.style.display = "block";
        this.el.moodJourneyTimeline.innerHTML = "";

        this._moodJourney.forEach((entry, i) => {
            if (i > 0) {
                const conn = document.createElement("div");
                conn.className = "mood-dot-connector";
                this.el.moodJourneyTimeline.appendChild(conn);
            }
            const dot = document.createElement("div");
            dot.className = "mood-dot";
            dot.innerHTML = `
                <div class="mood-dot-circle" style="background: ${entry.color}; border-color: ${entry.color};"></div>
                <span class="mood-dot-label">${entry.emotion}</span>
            `;
            this.el.moodJourneyTimeline.appendChild(dot);
        });
        this.el.moodJourneyTimeline.scrollLeft = this.el.moodJourneyTimeline.scrollWidth;
    },

    // --- Spotify ---

    _showSpotifyBar(query) {
        if (!this.el.spotifyBar) return;
        this.el.spotifyBar.style.display = "flex";
        if (this.el.spotifyTrack) this.el.spotifyTrack.textContent = query || "Playing from Spotify";
        if (this.el.spotifyArtist) this.el.spotifyArtist.textContent = "";
    },

    _updateSpotifyBar(track, artist) {
        if (!this.el.spotifyBar) return;
        this.el.spotifyBar.style.display = "flex";
        if (this.el.spotifyTrack) this.el.spotifyTrack.textContent = track || "Playing";
        if (this.el.spotifyArtist) this.el.spotifyArtist.textContent = artist || "";
    },

    _hideSpotifyBar() {
        if (this.el.spotifyBar) this.el.spotifyBar.style.display = "none";
    },

    // --- Courses ---

    _showCourses() {
        this.el.courseList.innerHTML = "";
        Object.entries(COURSES).forEach(([id, course]) => {
            const progress = this._getCourseProgress(id);
            const totalDays = course.days.length;
            const currentDay = progress.currentDay;
            const card = document.createElement("div");
            card.className = "course-card";
            card.innerHTML = `
                <div class="course-card-header">
                    <span class="material-icons-round">${course.icon}</span>
                    <h3>${course.name}</h3>
                </div>
                <p>${course.description}</p>
                <div class="course-progress">
                    <span class="material-icons-round">trending_up</span>
                    <span>Day ${currentDay} of ${totalDays}${currentDay > 1 ? " — Continue" : " — Start"}</span>
                </div>
            `;
            card.addEventListener("click", () => this._startCourseDay(id));
            this.el.courseList.appendChild(card);
        });
        this.el.courseOverlay.style.display = "flex";
    },

    _getCourseProgress(courseId) {
        try {
            return JSON.parse(localStorage.getItem(`naada_course_${courseId}`)) || { currentDay: 1, completedDays: [] };
        } catch { return { currentDay: 1, completedDays: [] }; }
    },

    _saveCourseProgress(courseId, progress) {
        localStorage.setItem(`naada_course_${courseId}`, JSON.stringify(progress));
    },

    async _startCourseDay(courseId) {
        this.el.courseOverlay.style.display = "none";
        const course = COURSES[courseId];
        const progress = this._getCourseProgress(courseId);
        const dayData = course.days[progress.currentDay - 1];

        if (!dayData) {
            this._addBubble(`You've completed "${course.name}"! Starting over.`, "system");
            this._saveCourseProgress(courseId, { currentDay: 1, completedDays: [] });
            return;
        }

        this._activeCourse = { courseId, dayData };
        await this.startSession();

        const waitForConnection = () => {
            if (this.ws.isConnected) {
                this.el.moodChips.style.display = "none";
                clearTimeout(this._chipTimeout);
                const msg = `I'm on Day ${dayData.day} of the "${course.name}" course. Today's session is "${dayData.title}" using ${dayData.therapy} therapy for ${dayData.duration} minutes with ${dayData.meditation} meditation. Please start this session.`;
                this.ws.sendText(msg);
                this._addBubble(`Course: ${course.name} — Day ${dayData.day}: ${dayData.title}`, "system");
                progress.completedDays.push(dayData.day);
                progress.currentDay = Math.min(progress.currentDay + 1, course.days.length + 1);
                this._saveCourseProgress(courseId, progress);
            } else {
                setTimeout(waitForConnection, 500);
            }
        };
        setTimeout(waitForConnection, 1000);
    },

    // --- Session Health Report ---

    _showSessionReport() {
        if (!this.el.sessionReport) return;

        const initial = this._initialWellnessScore || 65;
        const final = this._currentWellnessScore || (initial > 30 ? initial - 20 : initial);
        const improvement = initial - final;
        const pct = Math.round((improvement / Math.max(initial, 1)) * 100);

        if (this.el.reportScoreBefore) this.el.reportScoreBefore.textContent = initial;
        if (this.el.reportScoreAfter) this.el.reportScoreAfter.textContent = final;
        if (this.el.reportImprovementText) {
            this.el.reportImprovementText.textContent = improvement > 0
                ? `${pct}% stress reduction` : "Session completed";
        }

        if (this.el.reportMoodFlow) {
            this.el.reportMoodFlow.innerHTML = "";
            this._moodJourney.forEach((entry, i) => {
                if (i > 0) {
                    const arrow = document.createElement("span");
                    arrow.className = "report-mood-arrow material-icons-round";
                    arrow.textContent = "arrow_forward";
                    this.el.reportMoodFlow.appendChild(arrow);
                }
                const tag = document.createElement("span");
                tag.className = "report-mood-tag";
                tag.style.background = (MOOD_COLORS[entry.emotion] || ["#6b5ce7","#a78bfa"])[1];
                tag.textContent = entry.emotion;
                this.el.reportMoodFlow.appendChild(tag);
            });
            if (this._moodJourney.length === 0) {
                this.el.reportMoodFlow.innerHTML = '<span class="report-mood-tag" style="background:#6b7280">No mood data</span>';
            }
        }

        if (this.el.reportTherapies) {
            this.el.reportTherapies.innerHTML = "";
            const therapies = this._therapiesUsed.length > 0 ? this._therapiesUsed : ["none"];
            therapies.forEach(t => {
                if (t === "none") return;
                const tag = document.createElement("span");
                tag.className = "report-therapy-tag";
                tag.innerHTML = `<span class="material-icons-round">music_note</span>${THERAPY_LABELS[t] || t}`;
                this.el.reportTherapies.appendChild(tag);
            });
        }

        if (this.el.reportObservations) {
            this.el.reportObservations.innerHTML = "";
            const allIndicators = this._wellnessScores
                .map(s => s.indicators).filter(Boolean)
                .join(",").split(",").map(s => s.trim()).filter(Boolean);
            const insightTexts = (this._sessionInsights || []).map(i => i.text);
            const combined = [...new Set([...allIndicators, ...insightTexts])].slice(0, 8);
            if (combined.length > 0) {
                combined.forEach(obs => {
                    const item = document.createElement("div");
                    item.className = "report-obs-item";
                    item.innerHTML = `<span class="material-icons-round">check_circle</span>${obs}`;
                    this.el.reportObservations.appendChild(item);
                });
            } else {
                this.el.reportObservations.innerHTML = '<div class="report-obs-item"><span class="material-icons-round">info</span>Session observations will appear with camera enabled</div>';
            }
        }

        if (this._heartRate && this._heartRate.bpmHistory.length > 0) {
            const avgBPM = this._heartRate.getSessionAverage();
            const trend = this._heartRate.getTrend();
            const coherence = this._heartRate.coherence;
            if (this.el.reportAvgBpm) this.el.reportAvgBpm.textContent = avgBPM;
            if (this.el.reportCoherence) this.el.reportCoherence.textContent = coherence + "%";
            if (this.el.reportHrTrend) {
                const trendLabels = { decreasing: "Relaxing", increasing: "Elevating", stable: "Stable" };
                this.el.reportHrTrend.textContent = trendLabels[trend] || trend;
            }
            if (this.el.reportObservations) {
                const hrItem = document.createElement("div");
                hrItem.className = "report-obs-item";
                hrItem.innerHTML = `<span class="material-icons-round">favorite</span>Heart rate ${trend === "decreasing" ? "decreased" : "remained stable"} during therapy`;
                this.el.reportObservations.appendChild(hrItem);
            }
        }

        if (this.el.reportRecommendation) {
            const lastMood = this._moodJourney.length > 0
                ? this._moodJourney[this._moodJourney.length - 1].emotion : "neutral";
            const recommendations = {
                stressed: "We recommend the 7-Day Stress Relief Journey course for sustained improvement.",
                anxious: "Try daily 10-minute Tibetan Bowl sessions to build anxiety resilience.",
                sad: "The Indian Raga morning therapy can help lift your energy over time.",
                calm: "Wonderful progress! Maintain with 5-minute daily Om meditation.",
                relaxed: "You're in a great place. Consider the 21-Day Meditation Journey to deepen this.",
                happy: "Beautiful state! Share Naada with someone who needs healing today.",
                focused: "Keep this focus with daily Beta entrainment sessions before work.",
                peaceful: "Perfect for starting the 21-Day Meditation Journey.",
            };
            this.el.reportRecommendation.textContent = recommendations[lastMood]
                || "Based on your session, we recommend daily 10-minute sessions for sustained wellness improvement.";
        }

        this.el.sessionReport.style.display = "flex";
    },

    // --- Shareable Session Card (Canvas API) ---

    async _shareSessionCard() {
        try {
            const canvas = document.createElement("canvas");
            canvas.width = 600;
            canvas.height = 800;
            const ctx = canvas.getContext("2d");

            // Background
            const bg = ctx.createLinearGradient(0, 0, 600, 800);
            bg.addColorStop(0, "#0f0a1a");
            bg.addColorStop(0.5, "#1a0e2e");
            bg.addColorStop(1, "#0a0514");
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, 600, 800);

            ctx.beginPath();
            ctx.arc(500, 100, 200, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(124, 58, 237, 0.08)";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(100, 700, 180, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(6, 182, 212, 0.06)";
            ctx.fill();

            // Title
            ctx.font = "bold 36px Inter, sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.fillText("Naada", 300, 60);
            ctx.font = "14px Inter, sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.fillText("AI Sound Therapy Session", 300, 85);

            // Divider
            const divGrad = ctx.createLinearGradient(100, 0, 500, 0);
            divGrad.addColorStop(0, "rgba(124,58,237,0)");
            divGrad.addColorStop(0.5, "rgba(124,58,237,0.5)");
            divGrad.addColorStop(1, "rgba(124,58,237,0)");
            ctx.strokeStyle = divGrad;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(100, 100);
            ctx.lineTo(500, 100);
            ctx.stroke();

            // Scores
            const initial = this._initialWellnessScore || 65;
            const final = this._currentWellnessScore || (initial > 30 ? initial - 20 : initial);
            const improvement = initial - final;
            const pct = Math.round((improvement / Math.max(initial, 1)) * 100);

            ctx.font = "12px Inter, sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.textAlign = "center";
            ctx.fillText("BEFORE", 200, 150);
            ctx.font = "bold 64px Inter, sans-serif";
            ctx.fillStyle = "#ef4444";
            ctx.fillText(String(initial), 200, 220);
            ctx.font = "11px Inter, sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.fillText("Stress Level", 200, 245);

            ctx.font = "32px Inter, sans-serif";
            ctx.fillStyle = "#10b981";
            ctx.fillText("\u2192", 300, 210);

            ctx.font = "12px Inter, sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.fillText("AFTER", 400, 150);
            ctx.font = "bold 64px Inter, sans-serif";
            ctx.fillStyle = "#10b981";
            ctx.fillText(String(final), 400, 220);
            ctx.font = "11px Inter, sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.fillText("Stress Level", 400, 245);

            if (improvement > 0) {
                const badgeY = 290;
                ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
                ctx.beginPath();
                ctx.roundRect(200, badgeY - 18, 200, 36, 18);
                ctx.fill();
                ctx.font = "bold 16px Inter, sans-serif";
                ctx.fillStyle = "#10b981";
                ctx.textAlign = "center";
                ctx.fillText(`${pct}% stress reduction`, 300, badgeY + 6);
            }

            // Mood journey
            let y = 350;
            ctx.font = "12px Inter, sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.textAlign = "left";
            ctx.fillText("MOOD JOURNEY", 50, y);
            y += 30;

            let moodX = 50;
            this._moodJourney.forEach((entry, i) => {
                if (i > 0) {
                    ctx.font = "14px Inter, sans-serif";
                    ctx.fillStyle = "rgba(255,255,255,0.3)";
                    ctx.fillText("\u2192", moodX, y);
                    moodX += 20;
                }
                const color = (MOOD_COLORS[entry.emotion] || ["#6b5ce7","#a78bfa"])[1];
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.roundRect(moodX, y - 14, ctx.measureText(entry.emotion).width + 16, 24, 10);
                ctx.fill();
                ctx.font = "12px Inter, sans-serif";
                ctx.fillStyle = "#fff";
                ctx.fillText(entry.emotion, moodX + 8, y + 4);
                moodX += ctx.measureText(entry.emotion).width + 28;
            });

            // Therapies
            y += 50;
            ctx.font = "12px Inter, sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.textAlign = "left";
            ctx.fillText("THERAPY APPLIED", 50, y);
            y += 25;

            let tx = 50;
            this._therapiesUsed.forEach(t => {
                const label = THERAPY_LABELS[t] || t;
                ctx.fillStyle = "rgba(167, 139, 250, 0.15)";
                const tw = ctx.measureText(label).width + 16;
                ctx.beginPath();
                ctx.roundRect(tx, y - 12, tw, 24, 10);
                ctx.fill();
                ctx.font = "12px Inter, sans-serif";
                ctx.fillStyle = "#a78bfa";
                ctx.fillText(label, tx + 8, y + 4);
                tx += tw + 10;
                if (tx > 500) { tx = 50; y += 30; }
            });

            // Biometrics
            y += 50;
            ctx.font = "12px Inter, sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.textAlign = "left";
            ctx.fillText("BIOMETRICS", 50, y);
            y += 30;

            if (this._heartRate && this._heartRate.bpmHistory.length > 0) {
                const avgBPM = this._heartRate.getSessionAverage();
                const trend = this._heartRate.getTrend();
                const coherence = this._heartRate.coherence;

                ctx.fillStyle = "rgba(255,255,255,0.05)";
                ctx.beginPath(); ctx.roundRect(50, y, 150, 70, 12); ctx.fill();
                ctx.font = "bold 28px Inter, sans-serif";
                ctx.fillStyle = "#ef4444";
                ctx.textAlign = "center";
                ctx.fillText(avgBPM + " BPM", 125, y + 35);
                ctx.font = "10px Inter, sans-serif";
                ctx.fillStyle = "rgba(255,255,255,0.4)";
                ctx.fillText("AVG HEART RATE", 125, y + 55);

                ctx.fillStyle = "rgba(255,255,255,0.05)";
                ctx.beginPath(); ctx.roundRect(220, y, 150, 70, 12); ctx.fill();
                ctx.font = "bold 28px Inter, sans-serif";
                ctx.fillStyle = "#06b6d4";
                ctx.fillText(coherence + "%", 295, y + 35);
                ctx.font = "10px Inter, sans-serif";
                ctx.fillStyle = "rgba(255,255,255,0.4)";
                ctx.fillText("COHERENCE", 295, y + 55);

                ctx.fillStyle = "rgba(255,255,255,0.05)";
                ctx.beginPath(); ctx.roundRect(390, y, 160, 70, 12); ctx.fill();
                const trendLabels = { decreasing: "Relaxing", increasing: "Elevating", stable: "Stable" };
                ctx.font = "bold 22px Inter, sans-serif";
                ctx.fillStyle = "#10b981";
                ctx.fillText(trendLabels[trend] || trend, 470, y + 35);
                ctx.font = "10px Inter, sans-serif";
                ctx.fillStyle = "rgba(255,255,255,0.4)";
                ctx.fillText("HR TREND", 470, y + 55);
            }

            // Footer
            ctx.font = "11px Inter, sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.3)";
            ctx.textAlign = "center";
            ctx.fillText("Powered by Naada AI + Gemini", 300, 760);
            ctx.fillText(new Date().toLocaleDateString(), 300, 780);

            canvas.toBlob(async (blob) => {
                if (navigator.share && navigator.canShare) {
                    try {
                        const file = new File([blob], "naada-session.png", { type: "image/png" });
                        if (navigator.canShare({ files: [file] })) {
                            await navigator.share({
                                title: "My Naada Session",
                                text: `${pct}% stress reduction with AI Sound Therapy!`,
                                files: [file],
                            });
                            return;
                        }
                    } catch (e) {}
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "naada-session.png";
                a.click();
                URL.revokeObjectURL(url);
                this._addBubble("Session card saved!", "system");
            }, "image/png");
        } catch (e) {
            console.error("[Naada] Share card error:", e);
        }
    },

    // --- Daily Wellness Streak ---

    _showStreak() {
        if (!this.el.streakBadge || !this.el.streakCount) return;
        try {
            const data = JSON.parse(localStorage.getItem("naada_streak") || "{}");
            const streak = data.streak || 0;
            if (streak > 0) {
                this.el.streakCount.textContent = streak;
                this.el.streakBadge.style.display = "flex";
            }
        } catch (e) {}
    },

    _updateStreak() {
        try {
            const now = new Date();
            const today = now.toISOString().split("T")[0];
            const data = JSON.parse(localStorage.getItem("naada_streak") || "{}");

            const lastDate = data.lastDate || "";
            let streak = data.streak || 0;
            const history = data.history || [];

            if (lastDate !== today) {
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split("T")[0];
                streak = (lastDate === yesterdayStr) ? streak + 1 : 1;
            }

            history.push({
                date: today,
                score: this._currentWellnessScore || null,
                initialScore: this._initialWellnessScore || null,
                mood: this._currentMood,
                therapies: [...this._therapiesUsed],
            });

            localStorage.setItem("naada_streak", JSON.stringify({
                streak, lastDate: today, history: history.slice(-90),
            }));
            this._renderHeatmap();
        } catch (e) {
            console.warn("[Naada] Streak save error:", e);
        }
    },

    // --- Mood Heatmap Calendar ---

    _renderHeatmap() {
        if (!this.el.heatmapGrid || !this.el.moodHeatmap) return;
        try {
            const data = JSON.parse(localStorage.getItem("naada_streak") || "{}");
            const history = data.history || [];
            if (history.length === 0) return;

            const dateMap = {};
            history.forEach(entry => {
                if (!entry.date) return;
                dateMap[entry.date] = (dateMap[entry.date] || 0) + 1;
            });

            const grid = this.el.heatmapGrid;
            grid.innerHTML = "";
            const today = new Date();

            for (let i = 83; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split("T")[0];
                const count = dateMap[dateStr] || 0;

                const cell = document.createElement("div");
                cell.className = "heatmap-cell";
                let opacity = 0.08;
                if (count === 1) opacity = 0.3;
                else if (count === 2) opacity = 0.55;
                else if (count >= 3) opacity = 0.8;
                cell.style.background = `rgba(124,58,237,${opacity})`;
                cell.title = `${dateStr}: ${count} session${count !== 1 ? "s" : ""}`;
                grid.appendChild(cell);
            }
            this.el.moodHeatmap.style.display = "block";
        } catch (e) {
            console.warn("[Naada] Heatmap render error:", e);
        }
    },

    // --- AI Session Insight Toast ---

    _showSessionInsight(insight, category) {
        if (!this.el.insightToast || !this.el.insightText) return;
        this.el.insightText.textContent = insight;
        this.el.insightToast.dataset.category = category || "observation";

        const iconEl = this.el.insightToast.querySelector(".insight-icon");
        if (iconEl) {
            const icons = { observation: "psychology", progress: "trending_up",
                suggestion: "tips_and_updates", milestone: "emoji_events" };
            iconEl.textContent = icons[category] || "psychology";
        }

        this.el.insightToast.classList.remove("hiding");
        this.el.insightToast.style.display = "flex";

        clearTimeout(this._insightTimer);
        this._insightTimer = setTimeout(() => {
            this.el.insightToast.classList.add("hiding");
            setTimeout(() => {
                if (this.el.insightToast) this.el.insightToast.style.display = "none";
                this.el.insightToast.classList.remove("hiding");
            }, 500);
        }, 5000);

        if (category === "milestone" && navigator.vibrate) navigator.vibrate([50, 50, 100]);
        if (!this._sessionInsights) this._sessionInsights = [];
        this._sessionInsights.push({ text: insight, category });
    },
};
