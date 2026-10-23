// ============================================
// IYC STUDIO - MAIN JAVASCRIPT
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ============================================
    // MOBILE MENU TOGGLE
    // ============================================
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            
            // Animate hamburger icon
            const spans = this.querySelectorAll('span');
            spans[0].style.transform = navMenu.classList.contains('active') ? 'rotate(45deg) translateY(7px)' : 'none';
            spans[1].style.opacity = navMenu.classList.contains('active') ? '0' : '1';
            spans[2].style.transform = navMenu.classList.contains('active') ? 'rotate(-45deg) translateY(-7px)' : 'none';
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.navbar')) {
                navMenu.classList.remove('active');
                const spans = mobileMenuToggle.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
    }

    // ============================================
    // LEAD MAGNET POPUP
    // ============================================
    const leadMagnetPopup = document.getElementById('leadMagnetPopup');
    const closePopup = document.querySelector('.close-popup');
    const leadMagnetForm = document.getElementById('leadMagnetForm');
    
    // Fenêtre masquée pour l'instant.
    
    // Close popup
    if (closePopup) {
        closePopup.addEventListener('click', function() {
            leadMagnetPopup.classList.remove('active');
            sessionStorage.setItem('leadMagnetShown', 'true');
        });
    }
    
    // Close popup when clicking outside
    if (leadMagnetPopup) {
        leadMagnetPopup.addEventListener('click', function(e) {
            if (e.target === leadMagnetPopup) {
                leadMagnetPopup.classList.remove('active');
                sessionStorage.setItem('leadMagnetShown', 'true');
            }
        });
    }
    
    // Handle lead magnet form submission
    if (leadMagnetForm) {
        leadMagnetForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('leadEmail').value;
            
            // Simulate API call to email service
            console.log('Lead Magnet Email:', email);
            
            // Show success message
            alert('Merci ! Votre code de réduction de 10 % vous a été envoyé par email.');
            
            // Close popup
            leadMagnetPopup.classList.remove('active');
            sessionStorage.setItem('leadMagnetShown', 'true');
            
            // Here you would integrate with an actual email service like:
            // - Mailchimp API
            // - SendGrid API
            // - ConvertKit API
            // Example:
            // fetch('/api/subscribe', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ email: email, list: 'lead-magnet' })
            // });
        });
    }

    // ============================================
    // BOOKING MODAL
    // ============================================
    const bookingModal = document.getElementById('bookingModal');
    const closeModal = document.querySelector('.close-modal');

    // Close booking modal
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            bookingModal.classList.remove('active');
        });
    }
    
    // Close modal when clicking outside
    if (bookingModal) {
        bookingModal.addEventListener('click', function(e) {
            if (e.target === bookingModal) {
                bookingModal.classList.remove('active');
            }
        });
    }

    // ============================================
    // PORTFOLIO FILTERING
    // ============================================
    const filterButtons = document.querySelectorAll('.filter-btn');
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.dataset.filter;
            
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Filter portfolio items
            portfolioItems.forEach(item => {
                const category = item.dataset.category;
                
                if (filter === 'all' || category === filter) {
                    item.style.display = 'block';
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'scale(1)';
                    }, 10);
                } else {
                    item.style.opacity = '0';
                    item.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        item.style.display = 'none';
                    }, 300);
                }
            });
        });
    });

    // ============================================
    // PORTFOLIO LIGHTBOX
    // ============================================
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxCaption = document.getElementById('lightboxCaption');
    const lightboxClose = document.querySelector('.lightbox-close');
    const lightboxPrev = document.querySelector('.lightbox-prev');
    const lightboxNext = document.querySelector('.lightbox-next');
    
    let currentImageIndex = 0;
    let visibleImages = [];
    
    // Open lightbox when clicking portfolio item
    portfolioItems.forEach((item, index) => {
        item.addEventListener('click', function() {
            // Get all visible portfolio items
            visibleImages = Array.from(portfolioItems).filter(img => 
                window.getComputedStyle(img).display !== 'none'
            );
            
            currentImageIndex = visibleImages.indexOf(item);
            
            const img = item.querySelector('img');
            const overlay = item.querySelector('.portfolio-overlay');
            
            lightboxImage.src = img.src;
            lightboxImage.alt = img.alt;
            
            if (overlay) {
                const title = overlay.querySelector('h3')?.textContent || '';
                const subtitle = overlay.querySelector('p')?.textContent || '';
                lightboxCaption.textContent = `${title} - ${subtitle}`;
            }
            
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });
    
    // Close lightbox
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }
    
    if (lightbox) {
        lightbox.addEventListener('click', function(e) {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });
    }
    
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
    
    // Navigate lightbox
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', function(e) {
            e.stopPropagation();
            currentImageIndex = (currentImageIndex - 1 + visibleImages.length) % visibleImages.length;
            updateLightboxImage();
        });
    }
    
    if (lightboxNext) {
        lightboxNext.addEventListener('click', function(e) {
            e.stopPropagation();
            currentImageIndex = (currentImageIndex + 1) % visibleImages.length;
            updateLightboxImage();
        });
    }
    
    function updateLightboxImage() {
        const item = visibleImages[currentImageIndex];
        const img = item.querySelector('img');
        const overlay = item.querySelector('.portfolio-overlay');
        
        lightboxImage.src = img.src;
        lightboxImage.alt = img.alt;
        
        if (overlay) {
            const title = overlay.querySelector('h3')?.textContent || '';
            const subtitle = overlay.querySelector('p')?.textContent || '';
            lightboxCaption.textContent = `${title} - ${subtitle}`;
        }
    }
    
    // Keyboard navigation for lightbox
    document.addEventListener('keydown', function(e) {
        if (lightbox && lightbox.classList.contains('active')) {
            if (e.key === 'Escape') {
                closeLightbox();
            } else if (e.key === 'ArrowLeft' && lightboxPrev) {
                lightboxPrev.click();
            } else if (e.key === 'ArrowRight' && lightboxNext) {
                lightboxNext.click();
            }
        }
    });

    // ============================================
    // FAQ ACCORDION
    // ============================================
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', function() {
            const faqItem = this.parentElement;
            const isActive = faqItem.classList.contains('active');

            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('active');
                const button = item.querySelector('.faq-question');
                if (button) button.setAttribute('aria-expanded', 'false');
            });

            if (!isActive) {
                faqItem.classList.add('active');
                this.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // ============================================
    // CONTACT FORM SUBMISSION
    // ============================================
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const thanks = document.documentElement.lang === 'en'
                ? 'Thank you. I will reply soon.'
                : 'Merci pour votre message ! Je vous répondrai dans les plus brefs délais.';
            const failed = document.documentElement.lang === 'en'
                ? 'The message could not be sent. Please try again.'
                : 'Le message n’a pas pu partir. Réessayez.';
            const submitButton = contactForm.querySelector('[type="submit"]');
            if (submitButton) submitButton.disabled = true;

            fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(new FormData(contactForm)).toString()
            })
                .then((response) => {
                    if (!response.ok) throw new Error('form');
                    alert(thanks);
                    contactForm.reset();
                })
                .catch(() => {
                    alert(failed);
                })
                .finally(() => {
                    if (submitButton) submitButton.disabled = false;
                });
        });
    }

    // ============================================
    // SMOOTH SCROLL
    // ============================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#' && document.querySelector(href)) {
                e.preventDefault();
                document.querySelector(href).scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // ============================================
    // LAZY LOADING IMAGES
    // ============================================
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.classList.add('fade-in');
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }

    // ============================================
    // SCROLL ANIMATIONS
    // ============================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('slide-up');
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    document.querySelectorAll('.pricing-card, .testimonial-card, .service-type-card, .faq-item').forEach(el => {
        observer.observe(el);
    });

    // ============================================
    // LOAD MORE PORTFOLIO ITEMS
    // ============================================
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function() {
            // Here you would load more portfolio items from a database or API
            console.log('Load more portfolio items');
            
            // Simulate loading
            this.textContent = 'Chargement...';
            setTimeout(() => {
                this.textContent = 'Tous les projets affichés';
                this.disabled = true;
            }, 1000);
        });
    }

    // ============================================
    // HEADER SCROLL EFFECT
    // ============================================
    let lastScroll = 0;
    const header = document.querySelector('.header');
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
        } else {
            header.style.boxShadow = 'none';
        }
        
        lastScroll = currentScroll;
    });

});

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Format date to French format
function formatDateFR(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString('fr-FR', options);
}

// Validate email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}