// main.js - 클라이언트 기능 및 디자인 업그레이드
// 주요 변경 사항:
// 1. 'Cancel' 버튼(닫는 기능)은 모달에서 닫힘 처리 (빨간색)
// 2. 룸 리스트 페이지에 "Back to Start" 버튼을 통한 부드러운 페이지 전환 효과 적용
// 3. 메시지 전송/수신 시 GSAP 애니메이션 (fromTo 방식) 적용하여 부드럽게 나타나도록 함
// 4. 헤더에 실시간 현재 시간 및 참가자 수 업데이트

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  let username = '';
  let currentRoomId = '';
  let currentParticipantsCount = 0; // 참가자 수

  // DOM 요소 참조
  const startPage = document.getElementById('start-page');
  const startButton = document.getElementById('start-button');
  const usernamePopup = document.getElementById('username-popup');
  const usernameInput = document.getElementById('username-input');
  const usernameSubmit = document.getElementById('username-submit');
  const usernameCancle = document.getElementById('username-cancle');
  const roomListPage = document.getElementById('room-list-page');
  const roomTableBody = document.getElementById('room-table-body');
  const createRoomButton = document.getElementById('create-room-button');
  const createRoomPopup = document.getElementById('create-room-popup');
  const roomNameInput = document.getElementById('room-name-input');
  const roomPrivacySelect = document.getElementById('room-privacy-select');
  const roomPasswordDiv = document.getElementById('room-password-div');
  const roomPasswordInput = document.getElementById('room-password-input');
  const createRoomSubmit = document.getElementById('create-room-submit');
  const joinRoomPopup = document.getElementById('join-room-popup');
  const joinRoomPasswordInput = document.getElementById('join-room-password-input');
  const joinRoomPasswordSubmit = document.getElementById('join-room-password-submit');
  const roomPage = document.getElementById('room-page');
  const roomContent = document.getElementById('room-content');
  const leaveRoomButton = document.getElementById('leave-room-button');
  const roomStatusElem = document.getElementById('room-status');
  const toggleSidebarButton = document.getElementById('toggle-sidebar-button');
  const participantSidebar = document.getElementById('participant-sidebar');
  const closeSidebarButton = document.getElementById('close-sidebar-button');
  const backToStartButton = document.getElementById('back-to-start-button');
  
  let joinRoomId = '';
  let sidebarVisible = false;

  // 페이지 전환 효과: fromPage에서 toPage로 fade-out/fade-in 전환
  function transitionPage(fromPage, toPage) {
    gsap.to(fromPage, { opacity: 0, duration: 0.5, onComplete: () => {
      fromPage.classList.add('hidden');
      toPage.classList.remove('hidden');
      gsap.fromTo(toPage, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    }});
  }

  // 모달 애니메이션 (GSAP)
  function animateModal(modalElement) {
    const content = modalElement.querySelector('.modal-content');
    gsap.fromTo(content, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "power2.out" });
  }

  // 헤더 업데이트: 실시간 현재 시간 및 참가자 수 표시
  function updateRoomStatus() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    roomStatusElem.textContent = `Time: ${timeString} | Participants: ${currentParticipantsCount}`;
  }
  setInterval(() => {
    if (!roomStatusElem.classList.contains('hidden')) {
      updateRoomStatus();
    }
  }, 1000);

  // 시작 버튼 클릭 → 사용자 이름 입력 모달 표시
  startButton.addEventListener('click', () => {
    usernamePopup.classList.remove('hidden');
    animateModal(usernamePopup);
  });

  usernameSubmit.addEventListener('click', () => {
    if (usernameInput.value.trim() !== '') {
      username = usernameInput.value.trim();
      usernamePopup.classList.add('hidden');
      // 전환: 시작페이지 → 룸 리스트 페이지
      transitionPage(startPage, roomListPage);
      socket.emit('get-room-list');
    } else {
      alert('Please enter your name.');
    }
  });

  // 'Cancel' 버튼 클릭 시: 초기화 후 모달 닫기
  usernameCancle.addEventListener('click', () => {
    usernameInput.value = '';
    usernamePopup.classList.add('hidden');
  });

  // 룸 리스트 페이지의 "Back to Start" 버튼 클릭 시 전환
  backToStartButton.addEventListener('click', () => {
    transitionPage(roomListPage, startPage);
  });

  // 방 목록 업데이트
  socket.on('room-list', (rooms) => {
    roomTableBody.innerHTML = '';
    rooms.forEach(room => {
      const createdTime = new Date(room.createdAt).toLocaleTimeString();
      const now = Date.now();
      const activeDuration = Math.floor((now - room.createdAt) / 1000);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${room.roomName}</td>
        <td>Web Chat</td>
        <td>${room.creator}</td>
        <td>${room.participantsCount}</td>
        <td>${room.isPrivate ? 'Yes' : 'No'}</td>
        <td>${createdTime} (${activeDuration}s active)</td>
        <td><button class="join-room-btn btn primary-btn" data-room-id="${room.id}" data-is-private="${room.isPrivate}">Join</button></td>
      `;
      roomTableBody.appendChild(tr);
    });
    document.querySelectorAll('.join-room-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const roomId = btn.getAttribute('data-room-id');
        const isPrivate = btn.getAttribute('data-is-private') === 'true';
        if (isPrivate) {
          joinRoomId = roomId;
          joinRoomPopup.classList.remove('hidden');
          animateModal(joinRoomPopup);
        } else {
          joinRoom(roomId, '');
        }
      });
    });
  });

  createRoomButton.addEventListener('click', () => {
    createRoomPopup.classList.remove('hidden');
    animateModal(createRoomPopup);
  });

  roomPrivacySelect.addEventListener('change', () => {
    if (roomPrivacySelect.value === 'private') {
      roomPasswordDiv.classList.remove('hidden');
    } else {
      roomPasswordDiv.classList.add('hidden');
    }
  });

  createRoomSubmit.addEventListener('click', () => {
    const roomName = roomNameInput.value.trim();
    const category = 'webchat';
    const privacy = roomPrivacySelect.value;
    const isPrivate = privacy === 'private';
    const password = isPrivate ? roomPasswordInput.value : '';
    if (roomName === '') {
      alert('Please enter a room name.');
      return;
    }
    socket.emit('create-room', { roomName, category, creator: username, isPrivate, password }, (response) => {
      if (response.success) {
        alert('Room created successfully.');
        createRoomPopup.classList.add('hidden');
        roomNameInput.value = '';
        roomPasswordInput.value = '';
      } else {
        alert('Error creating room.');
      }
    });
  });

  joinRoomPasswordSubmit.addEventListener('click', () => {
    const password = joinRoomPasswordInput.value;
    if (joinRoomId) {
      joinRoom(joinRoomId, password);
      joinRoomPopup.classList.add('hidden');
      joinRoomPasswordInput.value = '';
      joinRoomId = '';
    }
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.add('hidden');
    });
  });

  // 참가자 사이드바 토글 (GSAP 슬라이드 애니메이션)
  toggleSidebarButton.addEventListener('click', () => {
    if (!sidebarVisible) {
      participantSidebar.classList.remove('hidden');
      gsap.fromTo(participantSidebar, { x: '100%' }, { x: '0%', duration: 0.5, ease: "power3.out" });
    } else {
      gsap.to(participantSidebar, { x: '100%', duration: 0.5, ease: "power3.in", onComplete: () => {
        participantSidebar.classList.add('hidden');
      }});
    }
    sidebarVisible = !sidebarVisible;
  });

  // 참가자 사이드바 닫기 버튼
  closeSidebarButton.addEventListener('click', () => {
    gsap.to(participantSidebar, { x: '100%', duration: 0.5, ease: "power3.in", onComplete: () => {
      participantSidebar.classList.add('hidden');
    }});
    sidebarVisible = false;
  });

  // 방 입장 (채팅 전용)
  function joinRoom(roomId, password) {
    socket.emit('join-room', { roomId, username, password }, (response) => {
      if (response.success) {
        currentRoomId = roomId;
        transitionPage(roomListPage, roomPage);
        roomContent.innerHTML = '';
        updateParticipantSidebar(response.room.participants);
        currentParticipantsCount = response.room.participants.length;
        updateRoomStatus();
        socket.off('participant-list');
        socket.on('participant-list', (participants) => {
          updateParticipantSidebar(participants);
          currentParticipantsCount = participants.length;
        });
        loadChatRoom();
        socket.emit('get-chat-history', { roomId: currentRoomId });
      } else {
        alert(response.message);
      }
    });
  }

  leaveRoomButton.addEventListener('click', () => {
    socket.emit('leave-room', { roomId: currentRoomId, username });
    roomContent.innerHTML = '';
    transitionPage(roomPage, roomListPage);
    currentRoomId = '';
    socket.emit('get-room-list');
    participantSidebar.classList.add('hidden');
    sidebarVisible = false;
  });

  // 채팅 방 UI 로드 및 메시지 애니메이션 적용
  function loadChatRoom() {
    roomContent.innerHTML = `
      <div class="chat-room-container">
        <div id="chat-window" class="chat-window"></div>
        <div class="chat-input-container">
          <input type="text" id="chat-input" class="input-field" placeholder="Type your message">
          <button id="send-chat-button" class="btn primary-btn">Send</button>
          <input type="file" id="chat-file-input" accept="image/*,video/*" style="display:none;">
          <button id="attach-file-button" class="btn primary-btn">Attach</button>
        </div>
      </div>
    `;
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const sendChatButton = document.getElementById('send-chat-button');
    const chatFileInput = document.getElementById('chat-file-input');
    const attachFileButton = document.getElementById('attach-file-button');

    sendChatButton.addEventListener('click', () => {
      const message = chatInput.value.trim();
      if (message !== '') {
        socket.emit('chat-message', { roomId: currentRoomId, username, message });
        chatInput.value = '';
      }
    });

    attachFileButton.addEventListener('click', () => {
      chatFileInput.click();
    });

    chatFileInput.addEventListener('change', () => {
      const file = chatFileInput.files[0];
      if (file) {
        const maxImageSize = 5 * 1024 * 1024; // 5MB
        const maxVideoSize = 10 * 1024 * 1024; // 10MB
        if (file.type.startsWith('image') && file.size > maxImageSize) {
          alert('Image file size exceeds 5MB limit.');
          chatFileInput.value = '';
          return;
        }
        if (file.type.startsWith('video') && file.size > maxVideoSize) {
          alert('Video file size exceeds 10MB limit.');
          chatFileInput.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
          const fileType = file.type.startsWith('image')
            ? 'image'
            : file.type.startsWith('video')
              ? 'video'
              : 'other';
          if (fileType === 'other') {
            alert('Only image or video files are supported.');
            return;
          }
          socket.emit('chat-file', { roomId: currentRoomId, username, file: { fileType, data: e.target.result } });
        };
        reader.readAsDataURL(file);
      }
    });

    socket.off('chat-history');
    socket.on('chat-history', (messages) => {
      chatWindow.innerHTML = '';
      messages.forEach(msg => {
        appendChatMessage(msg);
      });
      chatWindow.scrollTop = chatWindow.scrollHeight;
    });

    socket.off('chat-message');
    socket.on('chat-message', (data) => {
      appendChatMessage(data);
    });
  }

  // 채팅 메시지 추가 (애니메이션 적용)
  function appendChatMessage(data) {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message');
    const timeStr = new Date(data.timestamp).toLocaleTimeString();
    if (data.type === 'file' && data.file) {
      if (data.file.fileType === 'image') {
        msgDiv.innerHTML = `<span class="chat-time">[${timeStr}]</span> <strong>${data.username}:</strong><br/><img src="${data.file.data}" alt="Image" style="max-width:300px; max-height:300px;">`;
      } else if (data.file.fileType === 'video') {
        msgDiv.innerHTML = `<span class="chat-time">[${timeStr}]</span> <strong>${data.username}:</strong><br/><video src="${data.file.data}" controls style="max-width:300px; max-height:300px;"></video>`;
      }
    } else {
      msgDiv.innerHTML = `<span class="chat-time">[${timeStr}]</span> <strong>${data.username}:</strong> ${data.message}`;
    }
    chatWindow.appendChild(msgDiv);
    // GSAP 애니메이션: 부드럽게 fade-in & 약간 아래로 내려오며 확대 효과
    gsap.fromTo(msgDiv, 
      { opacity: 0, y: -20, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power3.out" }
    );
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  // 참가자 사이드바 업데이트 (참가자 목록 업데이트)
  function updateParticipantSidebar(participants) {
    let content = '<h3>Participants</h3><ul>';
    participants.forEach(p => {
      const joinTime = new Date(p.joinTime).toLocaleTimeString();
      content += `<li>${p.username} (Joined: ${joinTime})</li>`;
    });
    content += '</ul>';
    const participantListContent = document.getElementById('participant-list-content');
    participantListContent.innerHTML = content;
  }
});
