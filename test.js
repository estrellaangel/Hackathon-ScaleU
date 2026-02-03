// Test Answer Key
const answerKey = {
  q1: 'b', // Premium is regular payment
  q2: 'b', // Deductible definition
  q3: 'c', // In-network advantage
  q4: 'b', // When to pay copay
  q5: 'b', // Emergency room situations
  q6: 'b', // Telehealth appropriate use
  q7: 'b', // Avoiding surprise bills
  q8: 'b', // Coinsurance definition
  q9: 'c', // Out-of-pocket maximum
  q10: 'b', // Urgent care usage
  q11: 'b', // Insurance card info
  q12: 'c', // Generic medications
  q13: 'b', // How AIDed helps
  q14: 'b', // First step with AIDed
  q15: 'b', // Preventive care
  q16: 'a', // Verify in-network (true)
  q17: 'b', // Formulary definition
  q18: 'd', // Most expensive care
  q19: 'b', // Course benefit
  q20: 'c'  // Handling incorrect bills
};

const questionTitles = {
  q1: 'Premium definition',
  q2: 'Deductible definition',
  q3: 'In-network advantage',
  q4: 'Copay timing',
  q5: 'Emergency situations',
  q6: 'Telehealth usage',
  q7: 'Avoiding surprise bills',
  q8: 'Coinsurance definition',
  q9: 'Out-of-pocket maximum',
  q10: 'Urgent care usage',
  q11: 'Insurance card information',
  q12: 'Medication costs',
  q13: 'AIDed functionality',
  q14: 'Using AIDed',
  q15: 'Preventive care',
  q16: 'Verify in-network',
  q17: 'Formulary',
  q18: 'Most expensive care',
  q19: 'Course benefits',
  q20: 'Handling incorrect bills'
};

// Track progress
let answeredQuestions = new Set();

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  setupOptionListeners();
  setupFormSubmission();
});

// Setup option selection
function setupOptionListeners() {
  const options = document.querySelectorAll('.option');
  
  options.forEach(option => {
    option.addEventListener('click', () => {
      const input = option.querySelector('input[type="radio"]');
      input.checked = true;
      
      // Update visual state
      const allOptions = option.parentElement.querySelectorAll('.option');
      allOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      
      // Mark question as answered
      const questionCard = option.closest('.question-card');
      questionCard.classList.add('answered');
      
      // Track progress
      const questionNum = input.name;
      answeredQuestions.add(questionNum);
      updateProgress();
    });
  });
  
  // Also handle direct radio button clicks
  const radios = document.querySelectorAll('input[type="radio"]');
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      const option = radio.closest('.option');
      const allOptions = option.parentElement.querySelectorAll('.option');
      allOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      
      const questionCard = option.closest('.question-card');
      questionCard.classList.add('answered');
      
      answeredQuestions.add(radio.name);
      updateProgress();
    });
  });
}

// Update progress bar
function updateProgress() {
  const total = Object.keys(answerKey).length;
  const answered = answeredQuestions.size;
  const percentage = (answered / total) * 100;
  
  document.getElementById('answeredCount').textContent = answered;
  document.getElementById('progressPercent').textContent = Math.round(percentage) + '%';
  document.getElementById('progressBar').style.width = percentage + '%';
}

// Setup form submission
function setupFormSubmission() {
  const form = document.getElementById('testForm');
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Check if all questions are answered
    if (answeredQuestions.size < Object.keys(answerKey).length) {
      const unanswered = Object.keys(answerKey).length - answeredQuestions.size;
      alert(`Please answer all questions. You have ${unanswered} unanswered question(s).`);
      
      // Scroll to first unanswered question
      const firstUnanswered = document.querySelector('.question-card:not(.answered)');
      if (firstUnanswered) {
        firstUnanswered.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstUnanswered.style.animation = 'shake 0.5s';
      }
      return;
    }
    
    // Grade the test
    gradeTest();
  });
}

// Grade the test
function gradeTest() {
  let correct = 0;
  let incorrect = 0;
  const results = [];
  
  // Check each answer
  for (const [question, correctAnswer] of Object.entries(answerKey)) {
    const selected = document.querySelector(`input[name="${question}"]:checked`);
    const userAnswer = selected ? selected.value : null;
    
    const isCorrect = userAnswer === correctAnswer;
    if (isCorrect) {
      correct++;
    } else {
      incorrect++;
    }
    
    results.push({
      question: questionTitles[question],
      isCorrect: isCorrect,
      questionNum: question.replace('q', '')
    });
  }
  
  // Calculate score
  const total = Object.keys(answerKey).length;
  const percentage = Math.round((correct / total) * 100);
  const passed = percentage >= 80;
  
  // Show results
  showResults(percentage, correct, total, passed, results);
}

// Show results modal
function showResults(percentage, correct, total, passed, results) {
  const modal = document.getElementById('resultsModal');
  const scoreCircle = document.getElementById('scoreCircle');
  const scoreNumber = document.getElementById('scoreNumber');
  const resultTitle = document.getElementById('resultTitle');
  const resultMessage = document.getElementById('resultMessage');
  const reviewList = document.getElementById('reviewList');
  
  // Update score
  scoreNumber.textContent = percentage;
  
  // Update title and message
  if (passed) {
    resultTitle.textContent = '🎉 Congratulations! You Passed!';
    resultMessage.textContent = `You scored ${correct} out of ${total} (${percentage}%). You've demonstrated excellent health literacy and understanding of how to use AIDed effectively!`;
    scoreCircle.style.background = 'linear-gradient(135deg, #10b981, #059669)';
  } else {
    resultTitle.textContent = '📚 Keep Learning!';
    resultMessage.textContent = `You scored ${correct} out of ${total} (${percentage}%). Review the course materials and try again. You need 80% to pass.`;
    scoreCircle.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
  }
  
  // Build review list
  reviewList.innerHTML = '';
  results.forEach(result => {
    const reviewItem = document.createElement('div');
    reviewItem.className = `review-item ${result.isCorrect ? 'correct' : 'incorrect'}`;
    reviewItem.innerHTML = `
      <span style="font-size: 20px;">${result.isCorrect ? '✓' : '✗'}</span>
      <span>Question ${result.questionNum}: ${result.question}</span>
    `;
    reviewList.appendChild(reviewItem);
  });
  
  // Show modal
  modal.classList.add('show');
  
  // Scroll to top of modal
  document.querySelector('.results-content').scrollTop = 0;
}

// Retake test
function retakeTest() {
  // Reset form
  document.getElementById('testForm').reset();
  
  // Reset visuals
  document.querySelectorAll('.question-card').forEach(card => {
    card.classList.remove('answered');
  });
  document.querySelectorAll('.option').forEach(option => {
    option.classList.remove('selected');
  });
  
  // Reset progress
  answeredQuestions.clear();
  updateProgress();
  
  // Hide modal
  document.getElementById('resultsModal').classList.remove('show');
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Add shake animation
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);
