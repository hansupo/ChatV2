export function initializeImageViewer() {
  const imageViewer = document.querySelector('.image-viewer');
  const fullsizeImage = imageViewer.querySelector('.fullsize-image');
  const closeButton = imageViewer.querySelector('.close-viewer-button');
  const saveButton = imageViewer.querySelector('.save-image-button');

  // Function to open image viewer
  function openImageViewer(imageSrc) {
    fullsizeImage.src = imageSrc;
    imageViewer.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // Function to close image viewer
  function closeImageViewer() {
    imageViewer.classList.remove('active');
    document.body.style.overflow = '';
    fullsizeImage.src = '';
  }

  // Add click handler to all message images
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('message-image')) {
      openImageViewer(e.target.src);
    }
  });

  // Close on button click
  closeButton.addEventListener('click', closeImageViewer);

  // Close on image click
  fullsizeImage.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event from bubbling to imageViewer
    closeImageViewer();
  });

  // Save/Share button handler
  saveButton.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent closing when clicking the save button
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS && navigator.share) {
        // For iOS devices, use share sheet
        const response = await fetch(fullsizeImage.src);
        const blob = await response.blob();
        const file = new File([blob], 'image.jpg', { type: blob.type });
        
        const shareData = {
          files: [file],
          title: 'Share Image'
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          console.log('Shared successfully');
        } else {
          console.log('This image cannot be shared');
        }
      } else {
        // For other devices, use direct download
        const a = document.createElement('a');
        a.href = fullsizeImage.src;
        a.download = fullsizeImage.src.split('/').pop() || `image-${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.log('Share/Download failed:', error);
    }
  });

  // Close on background click
  imageViewer.addEventListener('click', (e) => {
    if (e.target === imageViewer) {
      closeImageViewer();
    }
  });

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageViewer.classList.contains('active')) {
      closeImageViewer();
    }
  });
} 