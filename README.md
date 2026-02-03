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

1. ASU Insurance plan

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
