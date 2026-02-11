import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CampaignProvider } from "./contexts/CampaignContext";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import ProfileChoice from "./pages/ProfileChoice";
import ContractorRegistration from "./pages/registration/ContractorRegistration";
import InfluencerRegistration from "./pages/registration/InfluencerRegistration";
import PendingApproval from "./pages/PendingApproval";
import RejectedStatus from "./pages/RejectedStatus";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ContractorDashboard from "./pages/contractor/Dashboard";
import InfluencerDashboard from "./pages/influencer/Dashboard";
import CreateCampaign from "./pages/campaign/CreateCampaign";
import CampaignView from "./pages/campaign/CampaignView";
import MyApplications from "./pages/influencer/MyApplications";
import AcceptedCampaignDetail from "./pages/influencer/AcceptedCampaignDetail";
import Profile from "./pages/Profile";
import History from "./pages/History";
import CheckEmail from "./pages/CheckEmail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CampaignProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Root → Welcome */}
              <Route path="/" element={<Navigate to="/welcome" replace />} />

              {/* Public auth flow */}
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/check-email" element={<CheckEmail />} />
              <Route path="/escolha-perfil" element={<ProfileChoice />} />
              <Route path="/cadastro-contratante" element={<ContractorRegistration />} />
              <Route path="/cadastro-influenciadora" element={<InfluencerRegistration />} />

              {/* Status pages (require login but NOT approval) */}
              <Route path="/aguardando-aprovacao" element={<ProtectedRoute requireApproval={false}><PendingApproval /></ProtectedRoute>} />
              <Route path="/conta-rejeitada" element={<ProtectedRoute requireApproval={false}><RejectedStatus /></ProtectedRoute>} />

              {/* Admin panel */}
              <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />

              {/* Contractor flow */}
              <Route path="/dashboard-contratante" element={<ProtectedRoute requiredRole="contractor"><ContractorDashboard /></ProtectedRoute>} />
              <Route path="/criar-campanha" element={<ProtectedRoute requiredRole="contractor"><CreateCampaign /></ProtectedRoute>} />

              {/* Influencer flow */}
              <Route path="/dashboard-influenciadora" element={<ProtectedRoute requiredRole="influencer"><InfluencerDashboard /></ProtectedRoute>} />
              <Route path="/minhas-candidaturas" element={<ProtectedRoute requiredRole="influencer"><MyApplications /></ProtectedRoute>} />
              <Route path="/campanha-detalhe/:id" element={<ProtectedRoute requiredRole="influencer"><AcceptedCampaignDetail /></ProtectedRoute>} />

              {/* Shared campaign view (role-aware) */}
              <Route path="/campanha/:id" element={<ProtectedRoute><CampaignView /></ProtectedRoute>} />

              {/* Shared pages */}
              <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/historico" element={<ProtectedRoute><History /></ProtectedRoute>} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CampaignProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
