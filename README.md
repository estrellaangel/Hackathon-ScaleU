# Health Insurance AI Chatbot - Frontend

An attractive and responsive front-end interface for a health insurance AI chatbot system.

## Features

- 🎨 **Modern & Attractive Design**: Beautiful gradient backgrounds, smooth animations, and professional UI
- 📱 **Fully Responsive**: Works seamlessly on desktop, tablet, and mobile devices
- 🏥 **Insurance Selection**: Sidebar with slider menu to select from 8 major health insurance providers
- 💬 **Chat Interface**: Clean chatbot UI ready for AI integration
- ⚡ **Interactive Elements**: Quick action buttons, suggestion chips, and smooth transitions
- 🔔 **Status Indicators**: Visual feedback for online status and selection states

## Insurance Providers Included

1. Blue Cross Blue Shield
2. UnitedHealthcare
3. Aetna
4. Cigna
5. Humana
6. Kaiser Permanente
7. Anthem
8. Medicare

## File Structure

```
├── index.html       # Main HTML structure
├── styles.css       # All styling and responsive design
├── script.js        # JavaScript functionality and chatbot integration
└── README.md        # Documentation
```

## Getting Started

1. **Open the application**:
   - Simply open `index.html` in your web browser
   - Or use a local server for best results

2. **Select Insurance**:
   - Click on any insurance card in the sidebar
   - Your selection will be saved automatically

3. **Chat Interface**:
   - Type messages in the input box
   - Click suggested questions for quick queries
   - The chatbot placeholder is ready for your AI integration

## Chatbot Integration Guide

### Method 1: Direct Integration in script.js

Replace the `generateBotResponse()` function in `script.js` with your AI API call:

```javascript
async function generateBotResponse(userMessage) {
    try {
        const response = await fetch('YOUR_AI_API_ENDPOINT', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_API_KEY'
            },
            body: JSON.stringify({
                message: userMessage,
                insurance: selectedInsurance,
                context: 'health_insurance'
            })
        });
        
        const data = await response.json();
        return data.message;
    } catch (error) {
        console.error('Error:', error);
        return 'Sorry, I encountered an error. Please try again.';
    }
}
```

### Method 2: Using the Exposed API

The application exposes a global API for chatbot integration:

```javascript
// Add a bot message from your chatbot
window.HealthInsuranceChat.addBotMessage('Your AI response here');

// Add a user message programmatically
window.HealthInsuranceChat.addUserMessage('User query');

// Get current insurance selection
const insurance = window.HealthInsuranceChat.selectedInsurance();
console.log(insurance); // { name: "Blue Cross Blue Shield", type: "blue-cross" }
```

### Method 3: Embed Third-Party Chatbot Widget

To embed a third-party chatbot (like Dialogflow, Rasa, etc.):

1. Replace the chat container in `index.html`:
```html
<div class="chat-container" id="chatContainer">
    <!-- Your chatbot embed code here -->
    <iframe src="YOUR_CHATBOT_URL" style="width: 100%; height: 100%; border: none;"></iframe>
</div>
```

2. Hide the chat input if your embedded chatbot has its own:
```css
.chat-input-container {
    display: none;
}
```

## Customization

### Colors
Edit the CSS variables in `styles.css`:
```css
:root {
    --primary-color: #4F46E5;
    --secondary-color: #06B6D4;
    /* ... modify other colors */
}
```

### Add More Insurance Providers
In `index.html`, add a new insurance card:
```html
<div class="insurance-card" data-insurance="your-insurance-id">
    <div class="insurance-icon">
        <i class="fas fa-your-icon"></i>
    </div>
    <div class="insurance-info">
        <h3>Insurance Name</h3>
        <p>Description</p>
    </div>
    <button class="select-btn">Select</button>
</div>
```

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Opera

## Dependencies

- Font Awesome 6.4.0 (for icons) - loaded via CDN
- No other external dependencies required!

## Future Enhancements

- [ ] Voice input support
- [ ] Multi-language support
- [ ] Dark mode toggle
- [ ] Chat history export
- [ ] Document upload for claims
- [ ] Integration with insurance APIs
- [ ] User authentication

## License

This project is open source and available for use in your hackathon project.

## Support

For questions or issues, please create an issue in the repository.

---

**Built with ❤️ for better healthcare access**
