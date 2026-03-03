import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CampaignProvider } from "@/contexts/CampaignContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

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

import ProfileRouter from "@/pages/profile/ProfileRouter";
import ContractorProfile from "@/pages/profile/ContractorProfile";
import InfluencerProfile from "@/pages/profile/InfluencerProfile";

import InfluencerPersonalData from "@/pages/profile/InfluencerPersonalData";
import PublicProfileKeyed from "@/pages/profile/PublicProfileKeyed";

import History from "./pages/History";
import CheckEmail from "./pages/CheckEmail";
import NotFound from "./pages/NotFound";

import LegacyProfile from "@/pages/Profile";
import ContractorPersonalData from "@/pages/profile/ContractorPersonalData";

// ✅ NOVO: tela de pagamento (simulado)
import PaymentSimulated from "./pages/campaign/PaymentSimulated";

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
              <Route path="/" element={<Navigate to="/welcome" replace />} />

              {/* Public auth flow */}
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/check-email" element={<CheckEmail />} />
              <Route path="/escolha-perfil" element={<ProfileChoice />} />
              <Route path="/cadastro-contratante" element={<ContractorRegistration />} />
              <Route path="/cadastro-influenciadora" element={<InfluencerRegistration />} />

              {/* Status pages (require login but NOT approval) */}
              <Route
                path="/aguardando-aprovacao"
                element={
                  <ProtectedRoute requireApproval={false}>
                    <PendingApproval />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/conta-rejeitada"
                element={
                  <ProtectedRoute requireApproval={false}>
                    <RejectedStatus />
                  </ProtectedRoute>
                }
              />

              {/* Admin panel */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Contractor flow */}
              <Route
                path="/dashboard-contratante"
                element={
                  <ProtectedRoute requiredRole="contractor">
                    <ContractorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/criar-campanha"
                element={
                  <ProtectedRoute requiredRole="contractor">
                    <CreateCampaign />
                  </ProtectedRoute>
                }
              />

              {/* ✅ NOVO: Pagamento */}
              <Route
                path="/pagamento/:id"
                element={
                  <ProtectedRoute requiredRole="contractor">
                    <PaymentSimulated />
                  </ProtectedRoute>
                }
              />

              {/* Influencer flow */}
              <Route
                path="/dashboard-influenciadora"
                element={
                  <ProtectedRoute requiredRole="influencer">
                    <InfluencerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/minhas-candidaturas"
                element={
                  <ProtectedRoute requiredRole="influencer">
                    <MyApplications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campanha-detalhe/:id"
                element={
                  <ProtectedRoute requiredRole="influencer">
                    <AcceptedCampaignDetail />
                  </ProtectedRoute>
                }
              />

              {/* Shared campaign view (role-aware) */}
              <Route
                path="/campanha/:id"
                element={
                  <ProtectedRoute>
                    <CampaignView />
                  </ProtectedRoute>
                }
              />

              {/* Profile routes (NEW) */}
              <Route
                path="/perfil"
                element={
                  <ProtectedRoute>
                    <ProfileRouter />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/perfil-contratante"
                element={
                  <ProtectedRoute requiredRole="contractor">
                    <ContractorProfile />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/perfil-influenciadora"
                element={
                  <ProtectedRoute requiredRole="influencer">
                    <InfluencerProfile />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/perfil-influenciadora/dados-pessoais"
                element={
                  <ProtectedRoute requiredRole="influencer">
                    <InfluencerPersonalData />
                  </ProtectedRoute>
                }
              />

              {/* Perfil público */}
              <Route path="/u/:id" element={<PublicProfileKeyed />} />

              <Route
                path="/perfil-contratante/dados-pessoais"
                element={
                  <ProtectedRoute requiredRole="contractor">
                    <ContractorPersonalData />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/perfil-antigo"
                element={
                  <ProtectedRoute>
                    <LegacyProfile />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/historico"
                element={
                  <ProtectedRoute>
                    <History />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CampaignProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;