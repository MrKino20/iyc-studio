// ============================================
// CLIENT GALLERY - PHOTO SELECTION SYSTEM
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ============================================
    // STATE MANAGEMENT
    // ============================================
    let sessionData = {
        sessionId: null,
        clientName: null,
        sessionDate: null,
        maxPhotos: 10,
        photos: [],
        selectedPhotos: []
    };

    // ============================================
    // PASSWORD AUTHENTICATION
    // ============================================
    const passwordForm = document.getElementById('passwordForm');
    const passwordScreen = document.getElementById('passwordScreen');
    const clientGallery = document.getElementById('clientGallery');
    
    if (passwordForm) {
        passwordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const sessionId = document.getElementById('sessionId').value;
            const password = document.getElementById('password').value;
            authenticateSession(sessionId, password);
        });
    }

    const codeFromUrl = new URLSearchParams(location.search).get("code");
    if (codeFromUrl && document.getElementById("sessionId")) {
        document.getElementById("sessionId").value = codeFromUrl;
    }
    const galleryBack = document.querySelector(".gallery-back");
    if (galleryBack) {
        galleryBack.addEventListener("click", function(event) {
            if (!document.referrer) return;
            try {
                if (new URL(document.referrer).origin !== location.origin) return;
            } catch (error) {
                return;
            }
            event.preventDefault();
            history.back();
        });
    }
    fetch("/api/client/me")
        .then((response) => response.json())
        .then((data) => { if (data.gallery) loadGallery(data.gallery); })
        .catch(() => {});
    
    async function authenticateSession(sessionId, password) {
        const loginError = document.getElementById("loginError");
        if (loginError) loginError.textContent = "";
        try {
            const response = await fetch("/api/client/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: sessionId, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Connexion impossible");
            loadGallery(data.gallery);
        } catch (error) {
            if (loginError) loginError.textContent = error.message;
        }
    }
    
    function loadGallery(data) {
        // Update session data
        sessionData = { ...sessionData, ...data };
        
        // Hide password screen, show gallery
        passwordScreen.style.display = 'none';
        clientGallery.style.display = 'block';
        
        // Populate gallery information
        sessionData.sessionId = data.code || sessionData.sessionId;
        document.getElementById('clientName').textContent = sessionData.clientName;
        document.getElementById('sessionDate').textContent = formatDateFR(sessionData.sessionDate);
        document.getElementById('maxPhotos').textContent = sessionData.maxPhotos;
        document.getElementById('maxCount').textContent = sessionData.maxPhotos;
        
        loadPhotosGrid(sessionData.photos);
        initializeSelectionSystem();
        updateSelectionCounters();
        if (sessionData.locked) lockSelection();
    }

    // ============================================
    // LOAD PHOTOS INTO GRID
    // ============================================
    function loadPhotosGrid(photos) {
        const grid = document.getElementById('proofingGrid');
        const emptyState = document.getElementById('emptyState');
        
        if (!grid) return;
        
        grid.innerHTML = '';
        
        if (photos.length === 0) {
            emptyState.textContent = document.documentElement.lang === "en" ? "No photos available" : "Aucune photo disponible";
            return;
        }
        
        emptyState.style.display = 'none';
        
        photos.forEach(photo => {
            const photoItem = createPhotoElement(photo);
            grid.appendChild(photoItem);
        });
        
        // Update counters
        document.getElementById('totalCount').textContent = photos.length;
    }
    
    function createPhotoElement(photo) {
        const div = document.createElement('div');
        div.className = 'proof-item';
        div.dataset.photoId = photo.id;
        div.dataset.selected = sessionData.selectedPhotos.includes(photo.id) ? 'true' : 'false';
        
        div.innerHTML = `
            <img src="${photo.thumbnail}" alt="Photo ${photo.id}" loading="lazy">
            <div class="proof-overlay">
                <button class="select-btn" aria-label="Sélectionner cette photo">
                    <span class="star-icon">☆</span>
                    <span class="star-icon-filled">⭐</span>
                </button>
                <span class="photo-number">#${photo.number || photo.id}</span>
            </div>
        `;
        
        return div;
    }

    // ============================================
    // SELECTION SYSTEM
    // ============================================
    function initializeSelectionSystem() {
        const proofItems = document.querySelectorAll('.proof-item');
        
        proofItems.forEach(item => {
            const selectBtn = item.querySelector('.select-btn');
            
            // Click on select button
            selectBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleSelection(item);
            });
            
            // Click on photo to open lightbox
            item.addEventListener('click', function() {
                openProofLightbox(item);
            });
        });
        
        // Submit selection buttons
        const submitButtons = document.querySelectorAll('#submitSelection, #submitSelectionBottom');
        submitButtons.forEach(btn => {
            btn.onclick = showConfirmationModal;
        });
    }
    
    function toggleSelection(item) {
        if (sessionData.locked) return;
        const photoId = item.dataset.photoId;
        const isSelected = item.dataset.selected === 'true';
        
        if (isSelected) {
            // Deselect
            item.dataset.selected = 'false';
            sessionData.selectedPhotos = sessionData.selectedPhotos.filter(id => id !== photoId);
        } else {
            // Check if max photos reached
            if (sessionData.selectedPhotos.length >= sessionData.maxPhotos) {
                alert(`Vous avez atteint la limite de ${sessionData.maxPhotos} photos pour votre forfait.`);
                return;
            }
            
            // Select
            item.dataset.selected = 'true';
            sessionData.selectedPhotos.push(photoId);
        }
        
        updateSelectionCounters();
    }
    
    function updateSelectionCounters() {
        const count = sessionData.selectedPhotos.length;
        const max = sessionData.maxPhotos;
        const remaining = max - count;
        
        // Update all counter displays
        document.getElementById('selectedCount').textContent = count;
        document.getElementById('bottomSelectedCount').textContent = count;
        document.getElementById('selectedFilterCount').textContent = count;
        document.getElementById('remainingCount').textContent = remaining;
        
        // Enable/disable submit button
        const submitButtons = document.querySelectorAll('#submitSelection, #submitSelectionBottom');
        submitButtons.forEach(btn => {
            if (count > 0) {
                btn.disabled = false;
            } else {
                btn.disabled = true;
            }
        });
        
        // Show/hide selection summary bar
        const selectionSummary = document.getElementById('selectionSummary');
        if (count > 0) {
            selectionSummary.classList.add('active');
        } else {
            selectionSummary.classList.remove('active');
        }
    }

    // ============================================
    // FILTERING
    // ============================================
    const filterTags = document.querySelectorAll('.filter-tag');
    
    filterTags.forEach(tag => {
        tag.addEventListener('click', function() {
            const filter = this.dataset.filter;
            
            // Update active tag
            filterTags.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Filter photos
            const proofItems = document.querySelectorAll('.proof-item');
            proofItems.forEach(item => {
                const isSelected = item.dataset.selected === 'true';
                
                if (filter === 'all') {
                    item.style.display = 'block';
                } else if (filter === 'selected' && isSelected) {
                    item.style.display = 'block';
                } else if (filter === 'unselected' && !isSelected) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });

    // ============================================
    // LIGHTBOX FOR PROOFING
    // ============================================
    const proofLightbox = document.getElementById('proofLightbox');
    const proofLightboxImage = document.getElementById('proofLightboxImage');
    const lightboxPhotoNumber = document.querySelector('.lightbox-photo-number');
    const lightboxSelectionStatus = document.querySelector('.lightbox-selection-status');
    const lightboxSelect = document.querySelector('.lightbox-select');
    const lightboxClose = proofLightbox?.querySelector('.lightbox-close');
    const lightboxPrev = proofLightbox?.querySelector('.lightbox-prev');
    const lightboxNext = proofLightbox?.querySelector('.lightbox-next');
    
    let currentLightboxItem = null;
    let visibleItems = [];
    
    function openProofLightbox(item) {
        currentLightboxItem = item;
        
        // Get all visible items
        visibleItems = Array.from(document.querySelectorAll('.proof-item')).filter(i => 
            window.getComputedStyle(i).display !== 'none'
        );
        
        updateLightboxContent();
        proofLightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function updateLightboxContent() {
        if (!currentLightboxItem) return;
        
        const img = currentLightboxItem.querySelector('img');
        const photoId = currentLightboxItem.dataset.photoId;
        const isSelected = currentLightboxItem.dataset.selected === 'true';
        
        // Find original photo data for full resolution
        const photo = sessionData.photos.find(p => p.id === photoId);
        proofLightboxImage.src = photo ? photo.url : img.src;
        proofLightboxImage.alt = `Photo ${photoId}`;
        
        lightboxPhotoNumber.textContent = `#${photoId}`;
        lightboxSelectionStatus.textContent = isSelected ? (document.documentElement.lang === "en" ? "⭐ Selected" : "⭐ Sélectionnée") : "";
        
        // Update select button
        updateLightboxSelectButton(isSelected);
    }
    
    function updateLightboxSelectButton(isSelected) {
        const starIcon = lightboxSelect.querySelector('.star-icon');
        const starIconFilled = lightboxSelect.querySelector('.star-icon-filled');
        const selectText = lightboxSelect.querySelector('.select-text');
        
        if (isSelected) {
            starIcon.style.display = 'none';
            starIconFilled.style.display = 'inline';
            selectText.textContent = document.documentElement.lang === "en" ? "Deselect" : "Désélectionner";
        } else {
            starIcon.style.display = 'inline';
            starIconFilled.style.display = 'none';
            selectText.textContent = document.documentElement.lang === "en" ? "Select" : "Sélectionner";
        }
    }
    
    // Lightbox controls
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeProofLightbox);
    }
    
    if (proofLightbox) {
        proofLightbox.addEventListener('click', function(e) {
            if (e.target === proofLightbox) {
                closeProofLightbox();
            }
        });
    }
    
    function closeProofLightbox() {
        proofLightbox.classList.remove('active');
        document.body.style.overflow = 'auto';
        currentLightboxItem = null;
    }
    
    if (lightboxSelect) {
        lightboxSelect.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleSelection(currentLightboxItem);
            updateLightboxContent();
        });
    }
    
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', function(e) {
            e.stopPropagation();
            const currentIndex = visibleItems.indexOf(currentLightboxItem);
            const prevIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
            currentLightboxItem = visibleItems[prevIndex];
            updateLightboxContent();
        });
    }
    
    if (lightboxNext) {
        lightboxNext.addEventListener('click', function(e) {
            e.stopPropagation();
            const currentIndex = visibleItems.indexOf(currentLightboxItem);
            const nextIndex = (currentIndex + 1) % visibleItems.length;
            currentLightboxItem = visibleItems[nextIndex];
            updateLightboxContent();
        });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (proofLightbox.classList.contains('active')) {
            if (e.key === 'Escape') {
                closeProofLightbox();
            } else if (e.key === 'ArrowLeft') {
                lightboxPrev.click();
            } else if (e.key === 'ArrowRight') {
                lightboxNext.click();
            } else if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                lightboxSelect.click();
            }
        }
    });

    // ============================================
    // CONFIRMATION MODAL
    // ============================================
    const confirmationModal = document.getElementById('confirmationModal');
    const cancelConfirmation = document.getElementById('cancelConfirmation');
    const finalConfirmation = document.getElementById('finalConfirmation');
    const selectedPhotosPreview = document.getElementById('selectedPhotosPreview');
    const confirmCount = document.getElementById('confirmCount');
    
    function showConfirmationModal() {
        if (sessionData.selectedPhotos.length === 0) {
            alert(document.documentElement.lang === "en" ? "Please select at least one photo." : "Veuillez sélectionner au moins une photo.");
            return;
        }
        
        confirmCount.textContent = sessionData.selectedPhotos.length;
        
        // Show preview of selected photos
        selectedPhotosPreview.innerHTML = '';
        sessionData.selectedPhotos.forEach(photoId => {
            const photo = sessionData.photos.find(p => p.id === photoId);
            if (photo) {
                const img = document.createElement('img');
                img.src = photo.thumbnail;
                img.alt = `Photo ${photoId}`;
                selectedPhotosPreview.appendChild(img);
            }
        });
        
        confirmationModal.classList.add('active');
    }
    
    if (cancelConfirmation) {
        cancelConfirmation.addEventListener('click', function() {
            confirmationModal.classList.remove('active');
        });
    }
    
    if (finalConfirmation) {
        finalConfirmation.addEventListener('click', submitSelection);
    }

    // ============================================
    // SUBMIT SELECTION
    // ============================================
    async function submitSelection() {
        finalConfirmation.disabled = true;
        try {
            const response = await fetch("/api/client/selection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photoIds: sessionData.selectedPhotos })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erreur lors de l'envoi");
            sessionData.locked = true;
            confirmationModal.classList.remove("active");
            showSuccessModal();
        } catch (error) {
            alert(error.message);
        } finally {
            finalConfirmation.disabled = false;
        }
    }

    // ============================================
    // SUCCESS MODAL
    // ============================================
    const successModal = document.getElementById('successModal');
    const closeSuccess = document.getElementById('closeSuccess');
    const successCount = document.getElementById('successCount');
    const successSessionId = document.getElementById('successSessionId');
    const successDate = document.getElementById('successDate');
    
    function showSuccessModal() {
        successCount.textContent = sessionData.selectedPhotos.length;
        successSessionId.textContent = sessionData.sessionId;
        successDate.textContent = formatDateFR(new Date());
        
        successModal.classList.add('active');
    }
    
    if (closeSuccess) {
        closeSuccess.addEventListener('click', function() {
            successModal.classList.remove('active');
            lockSelection();
        });
    }

    function lockSelection() {
        sessionData.locked = true;
        document.querySelectorAll('.select-btn, .lightbox-select').forEach(btn => {
            btn.disabled = true;
        });
        document.querySelectorAll('#submitSelection, #submitSelectionBottom').forEach(btn => {
            btn.disabled = true;
            btn.textContent = document.documentElement.lang === "en" ? "Selection confirmed" : "Sélection validée";
        });
    }

    // ============================================
    // LOGOUT
    // ============================================
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm(document.documentElement.lang === "en" ? "Are you sure you want to log out?" : "Êtes-vous sûr de vouloir vous déconnecter ?")) {
                fetch("/api/client/logout", { method: "POST" });
                sessionData = {
                    sessionId: null,
                    clientName: null,
                    sessionDate: null,
                    maxPhotos: 10,
                    photos: [],
                    selectedPhotos: []
                };
                
                // Show password screen
                clientGallery.style.display = 'none';
                passwordScreen.style.display = 'flex';
                
                // Reset form
                document.getElementById('passwordForm').reset();
            }
        });
    }

});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDateFR(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const locale = document.documentElement.lang === "en" ? "en-US" : "fr-FR";
    return new Date(date).toLocaleDateString(locale, options);
}