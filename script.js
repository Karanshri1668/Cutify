
        // DOM elements
        const audio = document.getElementById('audio');
        const playBtn = document.getElementById('play-btn');
        const playIcon = document.getElementById('play-icon');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const likeBtn = document.getElementById('like-btn');
        const shuffleBtn = document.getElementById('shuffle-btn');
        const repeatBtn = document.getElementById('repeat-btn');
        const randomBtn = document.getElementById('random-btn');
        const albumArt = document.getElementById('album-art');
        const songTitle = document.getElementById('song-title');
        const songArtist = document.getElementById('song-artist');
        const progress = document.getElementById('progress');
        const progressBar = document.getElementById('progress-bar');
        const currentTimeEl = document.getElementById('current-time');
        const durationEl = document.getElementById('duration');
        const trackList = document.getElementById('track-list');
        const noResults = document.getElementById('no-results');
        const playlistToggle = document.getElementById('playlist-toggle');
        const playlistContainer = document.getElementById('playlist-container');
        const closePlaylist = document.getElementById('close-playlist');
        const searchInput = document.getElementById('search');

        // Player state
        let currentTrackIndex = 0;
        let isPlaying = false;
        let isShuffled = false;
        let isRepeat = false;
        let likedTracks = JSON.parse(localStorage.getItem('likedTracks')) || [];
        let musicData = [];
        let filteredTracks = [];
        let originalTrackOrder = [];
        let isRandomMode = false;
        let searchActive = false;

        // Initialize player
        async function initPlayer() {
            try {
                // Try to load from JSON file
                let loadedData;
                try {
                    const response = await fetch('music-data.json');
                    if (!response.ok) throw new Error('Network response was not ok');
                    loadedData = await response.json();
                    if (!Array.isArray(loadedData)) throw new Error('Invalid data format');
                } catch (fetchError) {
                    console.warn('Using default music data:', fetchError);
                    loadedData = defaultMusicData;
                }

                // Process the loaded data
                musicData = loadedData.map(track => ({
                    ...track,
                    liked: likedTracks.includes(track.file)
                }));
                
                originalTrackOrder = [...musicData];
                filteredTracks = [...musicData];
                renderTrackList(musicData);
                loadTrack(currentTrackIndex);
                
                // Event listeners
                playBtn.addEventListener('click', togglePlay);
                prevBtn.addEventListener('click', prevTrack);
                nextBtn.addEventListener('click', nextTrack);
                likeBtn.addEventListener('click', toggleLike);
                shuffleBtn.addEventListener('click', toggleShuffle);
                repeatBtn.addEventListener('click', toggleRepeat);
                randomBtn.addEventListener('click', playRandomTrack);
                progressBar.addEventListener('click', setProgress);
                searchInput.addEventListener('input', filterTracks);
                
                playlistToggle.addEventListener('click', togglePlaylist);
                closePlaylist.addEventListener('click', togglePlaylist);
                
                audio.addEventListener('timeupdate', updateProgress);
                audio.addEventListener('ended', handleTrackEnd);
                audio.addEventListener('loadedmetadata', updateDuration);
                
                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => {
                    if (e.code === 'Space') {
                        e.preventDefault();
                        togglePlay();
                    } else if (e.code === 'ArrowRight') {
                        nextTrack();
                    } else if (e.code === 'ArrowLeft') {
                        prevTrack();
                    }
                });
                
            } catch (error) {
                console.error('Error initializing player:', error);
                noResults.style.display = 'block';
                noResults.innerHTML = `
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load music data</p>
                    <p style="font-size: 0.8rem; margin-top: 10px;">Playing sample tracks instead</p>
                `;
                
                // Fallback to default audio
                musicData = defaultMusicData;
                filteredTracks = [...musicData];
                renderTrackList(musicData);
                loadTrack(currentTrackIndex);
            }
        }

        // Filter tracks based on search
        function filterTracks() {
            const searchTerm = searchInput.value.toLowerCase();
            searchActive = searchTerm.length > 0;
            
            if (searchActive) {
                filteredTracks = musicData.filter(track => 
                    track.title.toLowerCase().includes(searchTerm) || 
                    track.artist.toLowerCase().includes(searchTerm)
                );
            } else {
                if (isShuffled) {
                    filteredTracks = [...filteredTracks]; // Maintain current shuffle order
                } else {
                    filteredTracks = [...originalTrackOrder];
                }
            }
            
            renderTrackList(filteredTracks);
            
            // Reset current track if it's not in filtered results
            if (filteredTracks.length > 0) {
                const currentTrack = musicData[currentTrackIndex];
                const existsInFiltered = filteredTracks.some(t => t.file === currentTrack?.file);
                if (!existsInFiltered) {
                    currentTrackIndex = 0;
                    if (isPlaying) {
                        loadTrack(currentTrackIndex);
                    }
                }
            }
        }

        // Toggle playlist visibility
        function togglePlaylist() {
            playlistContainer.classList.toggle('show');
            // Clear search when closing playlist
            if (!playlistContainer.classList.contains('show')) {
                searchInput.value = '';
                filterTracks();
            }
        }

        // Render track list
        function renderTrackList(tracks) {
            trackList.innerHTML = '';
            
            if (tracks.length === 0) {
                noResults.style.display = 'block';
                return;
            } else {
                noResults.style.display = 'none';
            }
            
            tracks.forEach((track, index) => {
                const trackEl = document.createElement('div');
                trackEl.className = `track ${index === currentTrackIndex && isPlaying ? 'active' : ''}`;
                trackEl.innerHTML = `
                    <div class="track-info">
                        <h3>${index === currentTrackIndex && isPlaying ? '<span class="playing-indicator"></span>' : ''}${track.title}</h3>
                        <p>${track.artist}</p>
                    </div>
                    <div class="track-duration">${formatTime(track.duration)}</div>
                    <div class="track-like ${track.liked ? 'liked' : ''}" title="${track.liked ? 'Unlike' : 'Like'}">
                        <i class="${track.liked ? 'fas' : 'far'} fa-heart"></i>
                    </div>
                `;
                
                trackEl.addEventListener('click', () => {
                    playTrack(index);
                    if (isRandomMode) {
                        isRandomMode = false;
                        randomBtn.classList.remove('active');
                    }
                });
                
                const likeBtn = trackEl.querySelector('.track-like');
                likeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleTrackLike(index);
                });
                
                trackList.appendChild(trackEl);
            });
        }

        // Load track
        function loadTrack(index) {
            const track = filteredTracks[index];
            
            // Find the original index in musicData
            const originalIndex = musicData.findIndex(t => t.file === track.file);
            if (originalIndex === -1) return;
            
            currentTrackIndex = index;
            audio.src = track.file;
            songTitle.textContent = track.title;
            songArtist.textContent = track.artist;
            
            // Update album art
            const albumImg = albumArt.querySelector('img');
            albumImg.src = track.cover || 'https://source.unsplash.com/random/500x500/?music,album';
            albumImg.alt = `${track.title} by ${track.artist}`;
            
            // Update like button
            likeBtn.innerHTML = `<i class="${track.liked ? 'fas' : 'far'} fa-heart"></i>`;
            likeBtn.title = track.liked ? 'Unlike' : 'Like';
            
            // Update active track in list
            updateActiveTrack();
            
            if (isPlaying) {
                audio.play().catch(e => console.log('Auto-play prevented:', e));
            }
        }

        // Update active track in playlist
        function updateActiveTrack() {
            const tracks = document.querySelectorAll('.track');
            tracks.forEach((t, i) => {
                t.classList.remove('active');
                if (i === currentTrackIndex && isPlaying) {
                    t.classList.add('active');
                    // Update track number to show playing indicator
                    const trackInfo = t.querySelector('.track-info h3');
                    if (trackInfo) {
                        trackInfo.innerHTML = `<span class="playing-indicator"></span>${filteredTracks[i].title}`;
                    }
                } else {
                    // Reset track info
                    const trackInfo = t.querySelector('.track-info h3');
                    if (trackInfo) {
                        trackInfo.textContent = filteredTracks[i].title;
                    }
                }
            });
        }

        // Play track
        function playTrack(index) {
            if (index < 0 || index >= filteredTracks.length) return;
            
            if (index === currentTrackIndex && isPlaying) return;
            
            currentTrackIndex = index;
            loadTrack(currentTrackIndex);
            
            if (!isPlaying) {
                isPlaying = true;
                playIcon.className = 'fas fa-pause';
                albumArt.classList.add('playing');
                audio.play().catch(e => console.log('Play prevented:', e));
            }
        }

        // Toggle play/pause
        function togglePlay() {
            if (isPlaying) {
                pauseTrack();
            } else {
                playTrack(currentTrackIndex);
            }
        }

        // Pause track
        function pauseTrack() {
            isPlaying = false;
            playIcon.className = 'fas fa-play';
            albumArt.classList.remove('playing');
            
            // Update active track in list
            const tracks = document.querySelectorAll('.track');
            tracks.forEach((t, i) => {
                if (i === currentTrackIndex) {
                    t.classList.remove('active');
                    // Reset track info
                    const trackInfo = t.querySelector('.track-info h3');
                    if (trackInfo) {
                        trackInfo.textContent = filteredTracks[i].title;
                    }
                }
            });
            
            audio.pause();
        }

        // Previous track
        function prevTrack() {
            if (isRandomMode) {
                playRandomTrack();
                return;
            }
            
            let newIndex = currentTrackIndex - 1;
            if (newIndex < 0) {
                newIndex = filteredTracks.length - 1;
            }
            playTrack(newIndex);
        }

        // Next track
        function nextTrack() {
            if (isRandomMode) {
                playRandomTrack();
                return;
            }
            
            let newIndex = currentTrackIndex + 1;
            if (newIndex >= filteredTracks.length) {
                newIndex = 0;
            }
            playTrack(newIndex);
        }

        // Handle track end
        function handleTrackEnd() {
            if (isRepeat) {
                audio.currentTime = 0;
                audio.play();
            } else {
                nextTrack();
            }
        }

        // Toggle shuffle
        function toggleShuffle() {
            isShuffled = !isShuffled;
            shuffleBtn.classList.toggle('active', isShuffled);
            
            if (isShuffled && !searchActive) {
                // Shuffle the filtered tracks
                filteredTracks = [...filteredTracks].sort(() => Math.random() - 0.5);
                // Find the current track in the new order
                const currentTrack = musicData[currentTrackIndex];
                const newIndex = filteredTracks.findIndex(t => t.file === currentTrack.file);
                currentTrackIndex = newIndex >= 0 ? newIndex : 0;
            } else if (!searchActive) {
                // Restore original order
                filteredTracks = [...originalTrackOrder];
                // Find the current track in the original order
                const currentTrack = musicData[currentTrackIndex];
                const newIndex = filteredTracks.findIndex(t => t.file === currentTrack.file);
                currentTrackIndex = newIndex >= 0 ? newIndex : 0;
            }
            
            renderTrackList(filteredTracks);
        }

        // Toggle repeat
        function toggleRepeat() {
            isRepeat = !isRepeat;
            repeatBtn.classList.toggle('active', isRepeat);
            audio.loop = isRepeat;
        }

        // Play random track
        function playRandomTrack() {
            isRandomMode = true;
            randomBtn.classList.add('active');
            
            const randomIndex = Math.floor(Math.random() * filteredTracks.length);
            playTrack(randomIndex);
        }

        // Toggle like for current track
        function toggleLike() {
            const track = filteredTracks[currentTrackIndex];
            
            // Find the original track in musicData
            const originalIndex = musicData.findIndex(t => t.file === track.file);
            if (originalIndex === -1) return;
            
            musicData[originalIndex].liked = !musicData[originalIndex].liked;
            track.liked = !track.liked;
            
            // Update like button
            likeBtn.innerHTML = `<i class="${track.liked ? 'fas' : 'far'} fa-heart"></i>`;
            likeBtn.title = track.liked ? 'Unlike' : 'Like';
            
            // Update track list
            const trackLikes = document.querySelectorAll('.track-like');
            if (trackLikes[currentTrackIndex]) {
                trackLikes[currentTrackIndex].innerHTML = `<i class="${track.liked ? 'fas' : 'far'} fa-heart"></i>`;
                trackLikes[currentTrackIndex].className = `track-like ${track.liked ? 'liked' : ''}`;
                trackLikes[currentTrackIndex].title = track.liked ? 'Unlike' : 'Like';
            }
            
            // Update localStorage
            updateLikedTracks();
        }

        // Toggle like for specific track
        function toggleTrackLike(index) {
            const track = filteredTracks[index];
            
            // Find the original track in musicData
            const originalIndex = musicData.findIndex(t => t.file === track.file);
            if (originalIndex === -1) return;
            
            musicData[originalIndex].liked = !musicData[originalIndex].liked;
            track.liked = !track.liked;
            
            // Update track list
            const trackLikes = document.querySelectorAll('.track-like');
            trackLikes[index].innerHTML = `<i class="${track.liked ? 'fas' : 'far'} fa-heart"></i>`;
            trackLikes[index].className = `track-like ${track.liked ? 'liked' : ''}`;
            trackLikes[index].title = track.liked ? 'Unlike' : 'Like';
            
            // If this is the current track, update main like button
            if (index === currentTrackIndex) {
                likeBtn.innerHTML = `<i class="${track.liked ? 'fas' : 'far'} fa-heart"></i>`;
                likeBtn.title = track.liked ? 'Unlike' : 'Like';
            }
            
            // Update localStorage
            updateLikedTracks();
        }

        // Update liked tracks in localStorage
        function updateLikedTracks() {
            likedTracks = musicData.filter(track => track.liked).map(track => track.file);
            localStorage.setItem('likedTracks', JSON.stringify(likedTracks));
        }

        // Update progress bar
        function updateProgress() {
            const { currentTime, duration } = audio;
            const progressPercent = (currentTime / duration) * 100;
            progress.style.width = `${progressPercent}%`;
            
            // Update time display
            currentTimeEl.textContent = formatTime(currentTime);
        }

        // Update duration
        function updateDuration() {
            durationEl.textContent = formatTime(audio.duration);
        }

        // Format time (seconds to MM:SS)
        function formatTime(seconds) {
            if (isNaN(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }

        // Set progress bar on click
        function setProgress(e) {
            const width = this.clientWidth;
            const clickX = e.offsetX;
            const duration = audio.duration;
            audio.currentTime = (clickX / width) * duration;
        }

        // Initialize the player when DOM is loaded
        document.addEventListener('DOMContentLoaded', initPlayer);
    