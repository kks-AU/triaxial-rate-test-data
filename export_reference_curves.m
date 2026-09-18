function export_reference_curves(root)
%EXPORT_REFERENCE_CURVES Export saved references and measured stage rates.
% Run from the public viewer repository after refreshing the source analyses:
%   export_reference_curves('/path/to/RateEffects')
% Source data and saved references are read only. PCHIP curves are evaluated
% directly from saved pp coefficients and never extrapolated.
arguments
    root (1,1) string
end
project=string(fileparts(mfilename('fullpath')));
addpath(root,fullfile(root,'Subscripts'));
src=fullfile(root,'Processed data and results');
out=fullfile(project,'data','reference');if ~isfolder(out),mkdir(out);end
cfg=triax_test_config(); manifest=jsondecode(fileread(fullfile(project,'data','manifest.json')));
for i=1:height(cfg)
    lab=cfg.LabID(i); shearFile=fullfile(src,lab+'_shear.mat');
    shearHash=sha256(shearFile);
    published=manifest.provenance(strcmp(string({manifest.provenance.SourceFile}),"Processed data and results/"+lab+"_shear.mat"));
    assert(numel(published)==1&&strcmpi(published.SHA256,shearHash), ...
        'Public shear data and source differ for %s. Refresh export_data first.',lab);
    S=load(shearFile,'shear_data');T=S.shear_data;
    stages=unique(T.StageNumber,'stable');stageRates=struct('stage',{},'rate',{});
    for j=1:numel(stages)
        v=double(T.StrainRate(T.StageNumber==stages(j)));v=v(isfinite(v));
        rate=NaN;
        if ~isempty(v)
            q=prctile(v,[25 75]);spread=q(2)-q(1);
            v=v(v>=q(1)-1.5*spread & v<=q(2)+1.5*spread);
            rate=mean(v,'omitnan');
        end
        stageRates(end+1)=struct('stage',double(stages(j)),'rate',rate); %#ok<AGROW>
    end
    referenceFile=fullfile(src,lab+'_auto_reference_rate_results.mat');
    result=struct('LabID',lab,'referenceRate',cfg.ReferenceRate_pct_min(i), ...
        'referenceRateSource',"configured",'rateUnits',"%/min", ...
        'rateSequence',stageRates,'q',[],'qp',[], ...
        'sourceShearSHA256',shearHash,'sourceReferenceSHA256',"", ...
        'curveMethod',"Saved PCHIP; evaluated only within reference control-point range");
    if isfile(referenceFile)
        validate_reference_source(shearFile,referenceFile,lab);
        A=load(referenceFile,'refQ','refQP','auto_rate_results','methodSettings');
        refRates=unique(A.auto_rate_results.ReferenceRate);
        assert(numel(refRates)==1&&isfinite(refRates)&&refRates>0,'Invalid reference rate for %s.',lab);
        result.referenceRate=double(refRates);result.referenceRateSource="saved analysis";
        result.q=sample(A.refQ,A.methodSettings.qPeakReferenceRateStrain_pct);
        result.qp=sample(A.refQP,A.methodSettings.qpPeakReferenceRateStrain_pct);
        result.sourceReferenceSHA256=sha256(referenceFile);
        % Check exported stage rates against the actual values used to fit
        % the reference analysis, including the previous stage at each jump.
        Q=A.auto_rate_results(A.auto_rate_results.Domain=="q",:);
        for k=1:height(Q)
            a=[stageRates.stage]==Q.Stage(k);b=[stageRates.stage]==Q.PreviousStage(k);
            assert(nnz(a)==1&&nnz(b)==1,'Missing stage for %s.',lab);
            assert(abs(stageRates(a).rate-Q.RateAfter(k))<1e-10 && ...
                abs(stageRates(b).rate-Q.RateBefore(k))<1e-10, 'Rate mismatch for %s.',lab);
        end
    end
    file=fullfile(out,lab+'.json');fid=fopen(file,'w');assert(fid>=0,'Cannot write %s.',file);
    cleanup=onCleanup(@()fclose(fid));fprintf(fid,'%s\n',jsonencode(result));clear cleanup;
    fprintf('%s: %d stage rates, reference available: %d\n',lab,numel(stages),~isempty(result.q));
end
end
function curve=sample(R,peakStrain)
x=unique([linspace(R.xmin,R.xmax,1200)';R.x(:);peakStrain]);
x=x(x>=R.xmin&x<=R.xmax);y=ppval(R.pp,x);
assert(all(isfinite(y)),'Reference contains nonfinite values.');
curve=struct('strain',x,'values',y(:),'minStrain',R.xmin,'maxStrain',R.xmax);
assert(max(abs(interp1(x,y,R.x)-R.y))<1e-8,'Reference control points changed.');
end
function value=sha256(file)
fid=fopen(file,'rb');assert(fid>=0);cleanup=onCleanup(@()fclose(fid));
bytes=fread(fid,Inf,'*uint8');digest=java.security.MessageDigest.getInstance('SHA-256');
digest.update(bytes);hash=typecast(digest.digest(),'uint8');
value=lower(reshape(dec2hex(hash,2).',1,[]));
end
