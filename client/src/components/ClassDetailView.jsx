import React, { useState, useEffect } from 'react';
import ExpandableText from './ExpandableText';
import AddOrienteeModal from './AddOrienteeModal';

function ClassDetailView({ className, onClose }) {
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [generatingReport, setGeneratingReport] = useState(null); // Track which report type is generating
  const [progress, setProgress] = useState(0);
  const [showAddOrientee, setShowAddOrientee] = useState(false);
  const [classDetailsListId, setClassDetailsListId] = useState(null);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  // Simulate progress during data loading
  useEffect(() => {
    if (!loading) {
      setLoadingProgress(0);
      return;
    }

    const duration = 4000; // 4 seconds estimated for data fetching
    const interval = 100; // Update every 100ms
    const increment = (interval / duration) * 100;
    
    const timer = setInterval(() => {
      setLoadingProgress(prev => {
        const newProgress = prev + increment;
        if (newProgress >= 90) {
          clearInterval(timer);
          return 90; // Stop at 90% until actual completion
        }
        return newProgress;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [loading]);

  // Simulate progress during report generation
  useEffect(() => {
    if (!generatingReport) {
      setProgress(0);
      return;
    }

    const duration = 8000; // 8 seconds estimated for report generation
    const interval = 100; // Update every 100ms
    const increment = (interval / duration) * 100;
    
    const timer = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + increment;
        if (newProgress >= 95) {
          clearInterval(timer);
          return 95; // Stop at 95% until actual completion
        }
        return newProgress;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [generatingReport]);

  useEffect(() => {
    // fetch list IDs
    async function fetchIds(){
      try{
        const resp = await fetch(`/api/class/${encodeURIComponent(className)}/ids`);
        if(resp.ok){
          const data = await resp.json();
          setClassDetailsListId(data.classDetailsListId);
        }
      }catch{}
    }
    fetchIds();

    async function fetchClassData() {
      try {
        // Use the existing report generation endpoint to get real ClickUp data with photos
        const response = await fetch(`/api/generate-report-data?className=${encodeURIComponent(className)}`);
        if (response.ok) {
          const data = await response.json();
          // Transform the report data into the format we need for the detail view
          const transformedData = transformReportDataForDetailView(data);
          
          // Complete the loading progress
          setLoadingProgress(100);
          setClassData(transformedData);
          
          // Brief delay to show 100% completion
          setTimeout(() => {
            setLoading(false);
            setLoadingProgress(0);
          }, 300);
        } else {
          // Fallback to mock data without photos
          const mockData = generateMockDataForClass(className);
          setLoadingProgress(100);
          setClassData(mockData);
          
          setTimeout(() => {
            setLoading(false);
            setLoadingProgress(0);
          }, 300);
        }
      } catch (error) {
        console.log('Using mock data for class:', className);
        // Fallback to mock data without photos  
        const mockData = generateMockDataForClass(className);
        setLoadingProgress(100);
        setClassData(mockData);
        
        setTimeout(() => {
          setLoading(false);
          setLoadingProgress(0);
        }, 300);
      }
    }

    fetchClassData();
  }, [className]);

  // Transform report generation data into detail view format
  const transformReportDataForDetailView = (reportData) => {
    const statusOrder = ['Graduated', 'Resigned', 'Released'];
    const groupedByStatus = reportData.classDetails.reduce((acc, person) => {
      const status = person.status || 'Unknown';
      if (!acc[status]) acc[status] = [];
      acc[status].push(person);
      return acc;
    }, {});

    // Calculate summary
    const summary = { graduated: 0, resigned: 0, released: 0 };
    for (const status of statusOrder) {
      summary[status.toLowerCase()] = groupedByStatus[status]?.length || 0;
    }

    // Helper function to process person grades (matching backend logic)
    const processPersonGrades = (feedbackGrades, pdOrienteeId) => {
      const personData = feedbackGrades.filter(item => item.pdOrientee === pdOrienteeId);
      
      const calculateWeightedAverage = (items, valueField) => {
        if (items.length === 0) return 0;
        
        let totalScore = 0;
        let totalWeight = 0;
        
        items.forEach(item => {
          const value = parseFloat(item[valueField]) || 0;
          const week = item.weekNum && item.weekNum.toLowerCase().includes('2') ? 2 : 1;
          const weight = week === 2 ? 2 : 1;
          
          totalScore += value * weight;
          totalWeight += weight;
        });
        
        return totalWeight > 0 ? totalScore / totalWeight : 0;
      };

      const dailyFeedback = personData.filter(item => 
        (item.effort !== 'N/A' && item.comp !== 'N/A' && item.application !== 'N/A') ||
        (!item.assignment || item.assignment === 'N/A')
      );
      
      const homework = personData.filter(item => 
        (item.assignment && item.assignment !== 'N/A') ||
        (item.effort === 'N/A' && item.comp === 'N/A' && item.application === 'N/A')
      );
      
      const effortAvg = calculateWeightedAverage(dailyFeedback, 'effort');
      const compAvg = calculateWeightedAverage(dailyFeedback, 'comp');
      const applicationAvg = calculateWeightedAverage(dailyFeedback, 'application');
      const dailyOverallAvg = (effortAvg + compAvg + applicationAvg) / 3;
      const homeworkAvg = calculateWeightedAverage(homework, 'grade');
      const dailyPercentage = (dailyOverallAvg / 3) * 100;
      const finalGrade = (dailyPercentage + homeworkAvg) / 2;
      
      return {
        effort: effortAvg,
        comp: compAvg,
        application: applicationAvg,
        homework: homeworkAvg,
        final: finalGrade
      };
    };

    // Transform orientees data
    const orientees = [];
    for (const status of statusOrder) {
      if (groupedByStatus[status]) {
        groupedByStatus[status].forEach(person => {
          const finalGrades = processPersonGrades(reportData.feedbackGrades, person.pdOrientee);
          
          orientees.push({
            name: person.name,
            status: person.status,
            pillar: person.pillar || 'N/A',
            market: person.market || 'N/A', 
            personality: person.personalityTag || 'N/A',
            email: person.cogentEmail || 'N/A',
            linkedin: person.linkedin || '',
            photo: person.imageUrl || '', // This comes from ClickUp attachments!
            wk1Feedback: person.wk1Feedback || 'No feedback provided',
            wk2Feedback: person.wk2Feedback || 'No feedback provided',
            finalGrades
          });
        });
      }
    }

    return {
      name: className,
      summary,
      orientees
    };
  };

  // Generate realistic mock data for any class
  const generateMockDataForClass = (className) => {
    const mockOrientees = [
      {
        name: "Jason Thorp", status: "Graduated", pillar: "Operations", 
        market: "N. Houston - Texas", personality: "Expressive - Charismatic, Talkative, Participatory",
        email: "jthorp@cogentanal", linkedin: "linkedin.com/in/jason-thorp", 
        photo: "",
        wk1Feedback: "Many years experience dealing with people (pastor) and in operational expertise. Make sure he follows the Cogent process and leans in on recalcitrant key stakeholders. His background in ministry has given him excellent interpersonal skills and the ability to navigate complex human dynamics, which will serve him well in client-facing roles.",
        wk2Feedback: "An Expressive/Amiable (Operations to Business Development) with well-developed interpersonal and operational skills. Jason is deeply loyal and naturally empathetic—qualities shaped by life experience, including raising his children alone and serving as a pastor for 15 years. He has a curious mind and a reflective approach, positioning him well to connect with clients and grow within the organization. His transition from ministry to business consulting shows adaptability and strong learning capabilities.",
        finalGrades: { effort: 2.4, comp: 2.2, application: 2.3, homework: 63, final: 66 }
      },
      {
        name: "Vincent Romeo", status: "Graduated", pillar: "Operations",
        market: "N/A", personality: "Analytical - Detail-oriented, Methodical",
        email: "vromeo@cogentanal", linkedin: "", 
        photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
        wk1Feedback: "Strong technical background with attention to detail. Needs to work on communication skills and client interaction. Shows promise in operational analysis but must develop stronger presentation skills.",
        wk2Feedback: "Significant improvement in client-facing situations. Good grasp of operational procedures and shows promise in process optimization. Vincent has demonstrated the ability to learn quickly and adapt his communication style to different audiences. His analytical mindset, combined with improved interpersonal skills, makes him a valuable asset to the operations team.",
        finalGrades: { effort: 2.8, comp: 2.6, application: 2.4, homework: 78, final: 72 }
      },
      {
        name: "Randall Sullivan", status: "Graduated", pillar: "People",
        market: "N. Houston - Texas", personality: "Amiable - Supportive, Team-oriented",
        email: "rsullivan@cogentanal", linkedin: "linkedin.com/in/randall-sullivan", 
        photo: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&h=150&fit=crop&crop=face",
        wk1Feedback: "Natural people skills and strong emotional intelligence. Great fit for People pillar work. Shows intuitive understanding of team dynamics and conflict resolution.",
        wk2Feedback: "Excellent progress in understanding organizational dynamics. Shows strong potential for HR and people management roles. Randall consistently demonstrates empathy, active listening skills, and the ability to facilitate difficult conversations. His natural inclination to support others, combined with growing business acumen, positions him perfectly for success in People-focused consulting engagements.",
        finalGrades: { effort: 2.9, comp: 2.7, application: 2.8, homework: 85, final: 81 }
      },
      {
        name: "Rob McLaughlin", status: "Graduated", pillar: "Operations",
        market: "Dallas - Texas", personality: "Driver - Results-focused, Direct",
        email: "rmclaughlin@cogentanal", linkedin: "", 
        photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
        wk1Feedback: "Strong drive and results orientation. Sometimes needs to slow down to ensure quality over speed. Excellent problem-solving instincts but should focus on thorough documentation.",
        wk2Feedback: "Better balance between speed and accuracy. Good operational instincts and problem-solving abilities. Rob has shown significant improvement in balancing his natural drive for results with the need for methodical, quality work. His direct communication style, when properly channeled, becomes an asset in driving client outcomes and internal process improvements.",
        finalGrades: { effort: 2.6, comp: 2.5, application: 2.7, homework: 71, final: 69 }
      },
      {
        name: "Christopher Maxwell", status: "Resigned", pillar: "Biz Dev",
        market: "Austin - Texas", personality: "Expressive - Outgoing, Persuasive",
        email: "cmaxwell@cogentanal", linkedin: "linkedin.com/in/chris-maxwell", 
        photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face",
        wk1Feedback: "Good communication skills and natural sales ability. Shows promise for business development work. Strong presentation skills and client rapport building.",
        wk2Feedback: "Decided to pursue other opportunities. Had good potential but personal circumstances required different path. While Christopher showed strong business development capabilities and natural relationship-building skills, he ultimately chose to pursue opportunities that better aligned with his personal and family commitments at this time.",
        finalGrades: { effort: 2.3, comp: 2.1, application: 2.0, homework: 45, final: 52 }
      },
      {
        name: "Timothy Ladison", status: "Released", pillar: "Operations",
        market: "Houston - Texas", personality: "Analytical - Quiet, Methodical",
        email: "tladison@cogentanal", linkedin: "", 
        photo: "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face",
        wk1Feedback: "Struggled with pace and client interaction requirements. Technical skills present but needs development. Shows potential in analytical work but requires significant coaching on client communication.",
        wk2Feedback: "Despite additional support, continued to struggle with core competencies. Not ready for client-facing work at this time. Timothy demonstrated strong analytical capabilities and attention to detail, but the fast-paced, client-facing nature of consulting proved challenging. While he has potential in more structured, behind-the-scenes analytical roles, the demands of our client engagement model were not a good fit at this stage of his professional development.",
        finalGrades: { effort: 1.8, comp: 1.5, application: 1.2, homework: 28, final: 35 }
      }
    ];

    // Calculate summary based on mock data
    const summary = mockOrientees.reduce((acc, orientee) => {
      acc[orientee.status.toLowerCase()]++;
      return acc;
    }, { graduated: 0, resigned: 0, released: 0 });

    return {
      name: className,
      summary,
      orientees: mockOrientees
    };
  };

  const handleGenerateReport = async (reportType) => {
    setGeneratingReport(reportType);
    setProgress(0);
    
    try {
      const response = await fetch(`/api/generate-report?className=${encodeURIComponent(className)}&type=${reportType}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Report generation failed: ${errorText}`);
      }
      
      // Complete the progress bar
      setProgress(100);
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${reportType}-${className.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // Brief delay to show 100% completion
      setTimeout(() => {
        setGeneratingReport(null);
        setProgress(0);
      }, 500);
    } catch (err) {
      alert(err.message);
      setGeneratingReport(null);
      setProgress(0);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Graduated': return 'bg-green-600';
      case 'Resigned': return 'bg-yellow-600'; 
      case 'Released': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusDotColor = (status) => {
    switch (status) {
      case 'Graduated': return 'bg-green-400';
      case 'Resigned': return 'bg-yellow-400';
      case 'Released': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  const refreshClassData = async ()=>{
    // simple re-fetch by calling existing function
    setLoading(true);
    await new Promise(resolve=>setTimeout(resolve,100));
    window.location.reload(); // quick hack; ideally re-fetch via API
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 min-w-[400px]">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-sky-600 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Fetching Class Details</h3>
            <p className="text-slate-400 text-sm">Loading orientee data from ClickUp...</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-300 font-medium">Progress</span>
              <span className="text-sky-400 font-semibold">{Math.round(loadingProgress)}%</span>
            </div>
            
            <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all duration-300 ease-out relative"
                style={{ width: `${loadingProgress}%` }}
              >
                {/* Animated shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
              </div>
            </div>

            {/* Status Text */}
            <div className="text-center">
              <p className="text-slate-400 text-xs">
                {loadingProgress < 30 ? 'Connecting to ClickUp...' :
                 loadingProgress < 60 ? 'Fetching orientee profiles...' :
                 loadingProgress < 85 ? 'Processing feedback data...' :
                 loadingProgress < 100 ? 'Finalizing details...' : 'Complete!'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex"
      onClick={(e) => {
        // Close modal if clicking on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Fixed position modal that takes full viewport */}
      <div className="w-full h-full flex items-center justify-center p-4">
        <div 
          className="bg-slate-900 rounded-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Fixed Header */}
          <div className="bg-slate-800 p-6 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">{classData.name}</h1>
              <p className="text-slate-400">
                {classData.summary.graduated} Graduated • {classData.summary.resigned} Resigned • {classData.summary.released} Released
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Export Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => handleGenerateReport('full')}
                  disabled={generatingReport !== null}
                  className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors relative overflow-hidden"
                >
                  {/* Progress bar for full report */}
                  {generatingReport === 'full' && (
                    <div 
                      className="absolute inset-0 bg-sky-400/30 transition-all duration-200 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                  <span className="relative z-10">
                    {generatingReport === 'full' ? `Generating... ${Math.round(progress)}%` : 'Export Full PDF'}
                  </span>
                </button>
                <button
                  onClick={() => handleGenerateReport('roster')}
                  disabled={generatingReport !== null}
                  className="bg-slate-600 hover:bg-slate-700 disabled:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm transition-colors relative overflow-hidden"
                >
                  {/* Progress bar for roster report */}
                  {generatingReport === 'roster' && (
                    <div 
                      className="absolute inset-0 bg-slate-400/30 transition-all duration-200 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                  <span className="relative z-10">
                    {generatingReport === 'roster' ? `Generating... ${Math.round(progress)}%` : 'Export Roster'}
                  </span>
                </button>
              </div>
              <button
                onClick={() => setShowAddOrientee(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Add Orientee
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 text-2xl leading-none p-1"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Single Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6">
              <div className="space-y-6">
                {classData.orientees.map((orientee, index) => (
                  <div key={index} className="bg-slate-800 rounded-xl overflow-hidden">
                    {/* Status Banner */}
                    <div className={`${getStatusColor(orientee.status)} text-white text-center py-3`}>
                      <h2 className="text-lg font-semibold">{orientee.status.toUpperCase()}</h2>
                    </div>

                    <div className="p-6">
                      {/* Employee Header */}
                      <div className="flex items-start gap-6 mb-6">
                        <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                          {orientee.photo ? (
                            <img src={orientee.photo} alt={orientee.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-2xl font-bold text-slate-300">{orientee.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-slate-100 mb-3">{orientee.name}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div><strong>Pillar:</strong> {orientee.pillar}</div>
                            <div><strong>Market:</strong> {orientee.market}</div>
                            <div className="md:col-span-2"><strong>Personality:</strong> {orientee.personality}</div>
                            <div><strong>Email:</strong> {orientee.email}</div>
                            {orientee.linkedin && <div><strong>LinkedIn:</strong> {orientee.linkedin}</div>}
                          </div>
                        </div>
                      </div>

                      {/* Feedback Section */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-700/30 p-4 rounded-lg border-l-4 border-green-400">
                          <h4 className="font-semibold text-slate-200 mb-2">Week 1 Feedback</h4>
                          <ExpandableText 
                            text={orientee.wk1Feedback} 
                            maxLength={150}
                            className="text-sm text-slate-300 leading-relaxed"
                          />
                        </div>
                        <div className="bg-slate-700/30 p-4 rounded-lg border-l-4 border-purple-400">
                          <h4 className="font-semibold text-slate-200 mb-2">Week 2 Feedback</h4>
                          <ExpandableText 
                            text={orientee.wk2Feedback} 
                            maxLength={150}
                            className="text-sm text-slate-300 leading-relaxed"
                          />
                        </div>
                      </div>

                      {/* Grades Summary */}
                      <div className="bg-slate-700/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-slate-200 mb-3">Final Grades Summary</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-center">
                          <div className="bg-slate-600/30 p-3 rounded-lg">
                            <p className="text-lg font-bold text-blue-400">{orientee.finalGrades.effort.toFixed(1)}/3</p>
                            <p className="text-xs text-slate-400">Effort</p>
                          </div>
                          <div className="bg-slate-600/30 p-3 rounded-lg">
                            <p className="text-lg font-bold text-blue-400">{orientee.finalGrades.comp.toFixed(1)}/3</p>
                            <p className="text-xs text-slate-400">Comp</p>
                          </div>
                          <div className="bg-slate-600/30 p-3 rounded-lg">
                            <p className="text-lg font-bold text-blue-400">{orientee.finalGrades.application.toFixed(1)}/3</p>
                            <p className="text-xs text-slate-400">App</p>
                          </div>
                          <div className="bg-slate-600/30 p-3 rounded-lg">
                            <p className="text-lg font-bold text-green-400">{orientee.finalGrades.homework.toFixed(0)}%</p>
                            <p className="text-xs text-slate-400">Homework</p>
                          </div>
                          <div className="bg-blue-600 p-3 rounded-lg col-span-2 sm:col-span-1">
                            <p className="text-xl font-bold text-white">{orientee.finalGrades.final.toFixed(0)}%</p>
                            <p className="text-xs text-blue-100">Final Grade</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {showAddOrientee && classDetailsListId && (
        <AddOrienteeModal
          listId={classDetailsListId}
          onClose={() => setShowAddOrientee(false)}
          onAdded={refreshClassData}
        />
      )}
    </div>
  );
}

export default ClassDetailView; 