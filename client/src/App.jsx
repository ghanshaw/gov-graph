import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client/react';
import client from './apollo';
import Header from './components/Header';
import BackToTop from './components/BackToTop';
import Presidents from './pages/Presidents';
import President from './pages/President';
import Home from './pages/Home';
import Detail from './pages/Detail';
import FullText from './pages/FullText';
import SupremeCourt from './pages/SupremeCourt';
import Timeline from './pages/Timeline';
import Economy from './pages/Economy';
import NaturalCourt from './pages/NaturalCourt';
import CaseDetail from './pages/CaseDetail';
import Congress from './pages/Congress';
import CongressSession from './pages/CongressSession';
import BillDetail from './pages/BillDetail';
import CorpusBrowser from './pages/CorpusBrowser';
import CaseGraph from './pages/CaseGraph';
import DataSources from './pages/DataSources';
import SourceDataset from './pages/SourceDataset';
import TagsIndex from './pages/TagsIndex';
import TagPage from './pages/TagPage';
import ExecutiveOrders from './pages/ExecutiveOrders';
import People from './pages/People';
import Person from './pages/Person';
import UsCode from './pages/UsCode';
import UsCodeTitle from './pages/UsCodeTitle';
import UsCodeSection from './pages/UsCodeSection';
import Demographics from './pages/Demographics';
import PopulationFile from './pages/PopulationFile';
import PopulationAcs from './pages/PopulationAcs';
import Reports from './pages/Reports';
import ReportDetail from './pages/ReportDetail';
import Structure from './pages/Structure';
import './index.css';

export default function App() {
  return (
    <ApolloProvider client={client}>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Presidents />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/economy" element={<Economy />} />
          <Route path="/economy/:tab" element={<Economy />} />
          <Route path="/supreme-court" element={<SupremeCourt />} />
          <Route path="/supreme-court/:courtSlug" element={<NaturalCourt />} />
          <Route path="/supreme-court/:courtSlug/:caseId" element={<CaseDetail />} />
          <Route path="/congress" element={<Congress />} />
          <Route path="/congress/:number" element={<CongressSession />} />
          <Route path="/congress/:number/:billType/:billNumber" element={<BillDetail />} />
          <Route path="/corpus" element={<CorpusBrowser />} />
          <Route path="/case-graph" element={<CaseGraph />} />
          <Route path="/structure" element={<Structure />} />
          <Route path="/abstract" element={<Navigate to="/structure" replace />} />
          <Route path="/sources" element={<DataSources />} />
          <Route path="/sources/:slug" element={<SourceDataset />} />
          <Route path="/tags" element={<TagsIndex />} />
          <Route path="/tags/:word" element={<TagPage />} />
          <Route path="/executive-orders" element={<ExecutiveOrders />} />
          <Route path="/people" element={<People />} />
          <Route path="/people/:id" element={<Person />} />
          <Route path="/code" element={<UsCode />} />
          <Route path="/code/:title" element={<UsCodeTitle />} />
          <Route path="/code/:title/:section" element={<UsCodeSection />} />
          <Route path="/demographics" element={<Demographics />} />
          <Route path="/demographics/:tab" element={<Demographics />} />
          <Route path="/population" element={<Navigate to="/demographics" replace />} />
          <Route path="/population/file" element={<PopulationFile />} />
          <Route path="/population/acs" element={<PopulationAcs />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:slug" element={<ReportDetail />} />
          <Route path="/:slug" element={<President />} />
          <Route path="/:slug/:docType" element={<Home />} />
          <Route path="/:slug/:docType/eo/:number" element={<Detail />} />
          <Route path="/:slug/:docType/doc/:documentNumber" element={<Detail />} />
          <Route path="/:slug/:docType/eo/:number/text" element={<FullText />} />
        </Routes>
        <BackToTop />
      </BrowserRouter>
    </ApolloProvider>
  );
}
